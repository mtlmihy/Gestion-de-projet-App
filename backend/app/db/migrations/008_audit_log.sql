-- ─────────────────────────────────────────────────────────────────────────────
-- 008 : Journal d'audit
--   Trace les actions sensibles : login (succès/échec), logout, modifs users,
--   changements de mot de passe, suppressions de projets, etc.
--
-- - user_id NULLable : permet de logger les tentatives de login échouées
--   (identifiant inconnu) ou les actions système.
-- - target_type/target_id : entité cible (user, projet, ...) — texte libre
--   pour rester souple.
-- - metadata jsonb : payload additionnel (ex: anciennes valeurs, raison).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
    id          BIGSERIAL PRIMARY KEY,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    user_id     UUID NULL REFERENCES utilisateurs(id) ON DELETE SET NULL,
    user_email  VARCHAR(255) NULL,
    action      VARCHAR(64)  NOT NULL,
    target_type VARCHAR(64)  NULL,
    target_id   VARCHAR(64)  NULL,
    ip          VARCHAR(64)  NULL,
    user_agent  TEXT         NULL,
    metadata    JSONB        NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id    ON audit_log (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action     ON audit_log (action);
