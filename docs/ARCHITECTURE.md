# ShiftControl Platform Architecture

## Objetivo

Evolucionar ShiftControl desde un HTML monolítico hacia una plataforma modular.

## Capas

UI
↓
Modules
↓
Services
↓
Storage
↓
Supabase

## Reglas

- Ningún módulo accede directamente a Supabase.
- Los datos pasan por Storage.
- Los cambios grandes se hacen mediante ramas Git.
