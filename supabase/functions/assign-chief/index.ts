// Edge Function: assign-chief
//
// Asigna o reemplaza la Jefa de Isla (rol CHIEF) de la empresa del
// administrador que llama. Es la única pieza del sistema que usa la
// service_role key — nunca vive en el navegador. La app la invoca con
// supabaseClient.functions.invoke('assign-chief', { body: { email, displayName } }).
//
// Reglas que esta función garantiza:
// - Solo un ADMIN activo puede llamarla (se verifica acá, no se confía en
//   que la UI ya lo haya ocultado).
// - Nunca borra un usuario de auth.users. Reemplazar solo desactiva la
//   membership anterior.
// - El cambio de Jefa de Isla (desactivar anterior + activar nueva +
//   registrar el evento) se hace en una sola transacción de Postgres
//   (función assign_chief, ver migración 20260804000001), así que no
//   puede quedar la empresa sin Jefa activa por un error a medio camino.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Método no permitido." }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: "Función mal configurada (faltan variables de entorno)." }, 500);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    // 1. Identificar al caller a partir de su JWT.
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!jwt) {
      return jsonResponse({ error: "No autenticado." }, 401);
    }

    const { data: callerData, error: callerError } = await admin.auth.getUser(jwt);
    if (callerError || !callerData?.user) {
      return jsonResponse({ error: "Sesión inválida o expirada." }, 401);
    }
    const callerId = callerData.user.id;

    // 2. Confirmar que el caller es ADMIN activo de alguna empresa.
    //    (Esta verificación se hace acá aunque la UI ya oculte el botón a
    //    quien no es admin, porque esta función es invocable directo.)
    const { data: callerMembership, error: membershipError } = await admin
      .from("company_memberships")
      .select("company_id, role, active")
      .eq("user_id", callerId)
      .eq("active", true)
      .maybeSingle();

    if (membershipError) {
      return jsonResponse({ error: `No se pudo verificar tu permiso: ${membershipError.message}` }, 500);
    }
    if (!callerMembership || callerMembership.role !== "ADMIN") {
      return jsonResponse({ error: "Solo un administrador puede asignar la Jefa de Isla." }, 403);
    }

    const companyId = callerMembership.company_id as string;

    // 3. Validar entrada.
    const body = await req.json().catch(() => ({}));
    const email = String((body as Record<string, unknown>).email || "").trim().toLowerCase();
    const displayName = String((body as Record<string, unknown>).displayName || "").trim();

    if (!email || !displayName) {
      return jsonResponse({ error: "Indica el correo y el nombre de la nueva Jefa de Isla." }, 400);
    }

    // 4. Resolver la cuenta destino: invitar si es nueva, reutilizar si ya existe.
    let targetUserId: string | null = null;

    const invite = await admin.auth.admin.inviteUserByEmail(email, {
      data: { display_name: displayName },
    });

    if (invite.error) {
      const alreadyExists = /already registered|already exists|already been registered/i.test(
        invite.error.message || "",
      );
      if (!alreadyExists) {
        return jsonResponse({ error: `No se pudo invitar a ${email}: ${invite.error.message}` }, 400);
      }

      // La cuenta ya existe — hay que encontrarla en vez de fallar.
      const { data: list, error: listError } = await admin.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });
      if (listError) {
        return jsonResponse(
          { error: `Ese correo ya está registrado, pero no se pudo verificar la cuenta: ${listError.message}` },
          400,
        );
      }
      const existing = list.users.find(
        (candidate) => (candidate.email || "").toLowerCase() === email,
      );
      if (!existing) {
        return jsonResponse(
          { error: "Ese correo ya está registrado, pero no se pudo encontrar la cuenta asociada." },
          400,
        );
      }
      targetUserId = existing.id;
    } else {
      targetUserId = invite.data.user?.id ?? null;
    }

    if (!targetUserId) {
      return jsonResponse({ error: "No se pudo determinar la cuenta del usuario." }, 400);
    }

    // 5. Un usuario solo puede pertenecer a una empresa (unique(user_id) en el esquema).
    const { data: existingMembership, error: existingMembershipError } = await admin
      .from("company_memberships")
      .select("company_id")
      .eq("user_id", targetUserId)
      .maybeSingle();

    if (existingMembershipError) {
      return jsonResponse(
        { error: `No se pudo verificar la membresía existente: ${existingMembershipError.message}` },
        400,
      );
    }
    if (existingMembership && existingMembership.company_id !== companyId) {
      return jsonResponse({ error: "Ese correo ya pertenece a otra empresa." }, 400);
    }

    // 6. Asignar/reemplazar de forma atómica.
    const { data: result, error: assignError } = await admin
      .rpc("assign_chief", {
        p_company_id: companyId,
        p_target_user_id: targetUserId,
        p_actor_user_id: callerId,
      })
      .single();

    if (assignError) {
      return jsonResponse({ error: assignError.message }, 400);
    }

    return jsonResponse(
      {
        ok: true,
        action: result?.action,
        targetUserId,
        previousUserId: result?.previous_user_id ?? null,
      },
      200,
    );
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Error inesperado." },
      500,
    );
  }
});
