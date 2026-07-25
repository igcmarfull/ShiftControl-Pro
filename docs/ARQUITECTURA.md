# Arquitectura objetivo

La V20 inicia una modularización gradual sin reescribir la aplicación.

## Estado actual

- `index.html`: interfaz y núcleo histórico.
- `src/v20-interface.css`: estilos de la versión vigente.
- `src/v20-interface.js`: comportamiento de la versión vigente.
- Persistencia: `localStorage`.

## Migración recomendada

1. Crear una capa única de almacenamiento compatible con `localStorage`.
2. Reemplazar accesos directos por un adaptador de datos.
3. Separar módulos: trabajadores, asistencia, finanzas, incidencias y reportes.
4. Añadir pruebas para importación, exportación y cálculos.
5. Conectar el adaptador a Supabase u otro backend.
6. Añadir autenticación y permisos multiusuario.
7. Convertir la interfaz en PWA si se requiere instalación y trabajo offline.

## Principio de seguridad

Cada extracción debe mantener las claves actuales de almacenamiento y permitir volver al respaldo V19.
