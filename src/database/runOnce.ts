/**
 * Ejecuta una preparación de esquema (CREATE TABLE IF NOT EXISTS, ADD COLUMN IF NOT EXISTS,
 * datos base...) una sola vez por proceso del servidor, en vez de en cada pedido.
 *
 * Los llamados simultáneos comparten la misma promesa. Si falla, se olvida el resultado
 * para que el próximo pedido lo vuelva a intentar.
 */
export function runOnce(task: () => Promise<void>): () => Promise<void> {
    let pending: Promise<void> | null = null;
    return () => {
        if (!pending) {
            pending = task().catch((error: unknown) => {
                pending = null;
                throw error;
            });
        }
        return pending;
    };
}
