# Guía de Migraciones Seguras

## ¿Qué ocurrió con la migración customer_reference?

Al agregar el campo `customer_reference` a la tabla `orders`, experimentamos una pérdida de datos. Esto ocurrió porque:

1. La migración fue ejecutada directamente sin realizar un backup previo
2. El comando `prisma migrate dev` puede causar pérdida de datos en algunos casos, especialmente si hay un error de configuración o si se usa incorrectamente

## Cómo prevenir la pérdida de datos en futuras migraciones

Para evitar pérdidas de datos en futuras migraciones, hemos implementado un flujo de trabajo seguro:

### 1. Usar el comando de migración segura

```bash
npm run db:safe-migrate
```

Este comando realiza las siguientes acciones:
- Crea un backup automático de la base de datos antes de migrar
- Ejecuta la migración de Prisma
- Verifica que la migración se haya realizado correctamente

### 2. Crear backups manuales frecuentes

```bash
npm run db:backup
```

Este comando crea un archivo SQL con todo el contenido de la base de datos en el directorio `backups/`.

### 3. Restaurar desde backup cuando sea necesario

```bash
npm run db:restore backups/nombre-del-archivo.sql
```

### 4. Recomendaciones para migraciones seguras:

1. **Siempre haz backup antes de migrar** - Usa `npm run db:backup` antes de cualquier migración
2. **Usa el comando de migración segura** - Prefiere `npm run db:safe-migrate` en lugar del comando regular
3. **Prueba las migraciones en desarrollo** - Antes de aplicar en producción
4. **Evita comandos que resetean la base de datos** - Como `prisma migrate reset` en producción
5. **Verifica la estructura tras migrar** - Usa `npx prisma db pull` para verificar que la estructura sea correcta

## Estructura de una migración segura en Prisma

Para crear una migración que preserve datos:

1. **Crea una nueva migración**:
```bash
npx prisma migrate dev --name descripcion_cambio
```

2. **Revisa el archivo SQL generado** en `prisma/migrations/[timestamp]_descripcion_cambio/migration.sql`

3. **Modifica el archivo SQL si es necesario** para asegurar que no haya pérdida de datos

4. **Ejecuta la migración segura**:
```bash
npm run db:safe-migrate
```

## Recuperación de datos perdidos

Si ocurre una pérdida de datos:

1. Detén inmediatamente la aplicación
2. Restaura desde el backup más reciente:
```bash
npm run db:restore backups/nombre-del-archivo.sql
```
3. Si no hay backup, contacta al equipo de soporte para intentar recuperar los datos

## Programación de backups automáticos

Para entornos de producción, recomendamos configurar backups automáticos:

1. Usa un cron job para ejecutar `npm run db:backup` diariamente
2. Configura una retención de backups (por ejemplo, conservar los últimos 30 días)
3. Almacena los backups en una ubicación segura, preferiblemente externa al servidor

```bash
# Ejemplo de cron job (ejecutar a las 3 AM todos los días)
0 3 * * * cd /ruta/a/tu/proyecto && npm run db:backup
```

---

**Recuerda**: La pérdida de datos puede ser costosa y difícil de recuperar. Siempre es mejor invertir tiempo en prevención que en recuperación.