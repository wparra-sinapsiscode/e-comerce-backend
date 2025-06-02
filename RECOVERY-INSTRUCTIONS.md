# Instrucciones de Recuperación de Datos

Este documento proporciona instrucciones detalladas para recuperar datos perdidos durante la migración del campo `customer_reference` en la tabla `orders`.

## 1. Crear un Backup de Seguridad (antes de intentar cualquier recuperación)

```bash
npm run db:backup
```

Esto creará un archivo de backup en el directorio `backups/` con formato `backup-YYYY-MM-DDTHH-MM-SS.sql`.

## 2. Inspeccionar la Base de Datos Actual

```bash
npm run db:inspect
```

Este comando generará un informe detallado de la estructura actual de la base de datos en el directorio `reports/`. Revisa este informe para entender el estado actual de los datos.

## 3. Intentar Recuperación Automática

```bash
npm run db:recover-orders
```

Este script realizará las siguientes acciones:
1. Buscará en los archivos de log todos los IDs de pedidos que se han creado
2. Comparará estos IDs con los pedidos existentes en la base de datos para identificar los pedidos faltantes
3. Buscará en los archivos de backup la información de los pedidos faltantes
4. Intentará restaurar los pedidos faltantes en la base de datos
5. Generará un informe detallado del proceso de recuperación

## 4. Revisar el Informe de Recuperación

El script de recuperación generará un informe en el directorio `reports/` con el formato `recovery-report-YYYY-MM-DDTHH-MM-SS.json`. Este informe contiene:

- Resumen de pedidos faltantes
- Pedidos encontrados en backups
- Pedidos restaurados exitosamente
- Pedidos que no se pudieron restaurar
- Pedidos que no se pudieron encontrar en ningún backup

## 5. Restaurar desde Backup (si la recuperación automática falló)

Si la recuperación automática no tuvo éxito, puedes intentar restaurar toda la base de datos desde un backup anterior:

```bash
npm run db:restore backups/nombre-del-archivo.sql
```

**ADVERTENCIA**: Este comando sobrescribirá todos los datos existentes en la base de datos. Asegúrate de tener un backup reciente antes de ejecutarlo.

## 6. Recrear la Migración Correctamente

Si has restaurado desde un backup, necesitarás volver a aplicar la migración del campo `customer_reference` correctamente:

```bash
# Primero, crea un backup
npm run db:backup

# Luego, ejecuta la migración segura
npm run db:safe-migrate
```

## Prevención de Problemas Futuros

Para evitar pérdidas de datos en el futuro:

1. **Siempre usar migraciones seguras**:
   ```bash
   npm run db:safe-migrate
   ```

2. **Crear backups regularmente**:
   ```bash
   npm run db:backup
   ```

3. **Nunca usar comandos que reseteen la base de datos en producción**:
   ```bash
   # ¡EVITAR en producción!
   npm run db:reset
   ```

4. **Revisar los archivos SQL de migración antes de aplicarlos**:
   - Los archivos se generan en `prisma/migrations/[timestamp]_[name]/migration.sql`
   - Verifica que no contengan operaciones destructivas como `DROP TABLE`

## Soporte Adicional

Si necesitas asistencia adicional con la recuperación de datos, contacta al equipo de desarrollo o al administrador de base de datos.