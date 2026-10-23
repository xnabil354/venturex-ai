import type { QueryInterface } from "sequelize";
import type { MigrationFn } from "umzug";

export const up: MigrationFn<QueryInterface> = async ({ context }) => {
  await context.sequelize.query(`CREATE TABLE journey_roadmap_progress (
    opportunity_id uuid NOT NULL REFERENCES user_generated_opportunities(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    fingerprint varchar(64) NOT NULL CHECK (fingerprint ~ '^[a-f0-9]{64}$'),
    stage smallint NOT NULL CHECK (stage BETWEEN 1 AND 6),
    completed_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (opportunity_id, fingerprint, stage)
  ); CREATE INDEX journey_progress_owner ON journey_roadmap_progress(user_id, opportunity_id);`);
};
export const down: MigrationFn<QueryInterface> = async ({ context }) => {
  await context.dropTable("journey_roadmap_progress");
};
