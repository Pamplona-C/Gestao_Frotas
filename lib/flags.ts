/**
 * Chave mestra da migração Firebase → moovia-backend.
 *
 * Cada service migrado consulta esta flag e escolhe o caminho: Firestore
 * (padrão, o app de hoje) ou REST no backend.
 *
 * Por que uma flag só, e não uma por service: assim que a autenticação sai do
 * Firebase, as Firestore Rules recusam tudo — não existe estado intermediário
 * em execução. Migrar é preparar todos os services e virar a chave uma vez.
 * A flag serve para desenvolver e testar sem afetar quem usa o app.
 */
export const USAR_BACKEND = process.env.EXPO_PUBLIC_USAR_BACKEND === 'true';
