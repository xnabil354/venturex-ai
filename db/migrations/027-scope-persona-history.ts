import { DataTypes, type QueryInterface } from "sequelize";
import type { MigrationFn } from "umzug";

async function failIfUnresolved(context: QueryInterface, table: string): Promise<void> {
  await context.sequelize.query(`
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM "${table}" WHERE "user_type" IS NULL) THEN
        RAISE EXCEPTION 'Cannot scope ${table}: one or more rows have no resolvable user type';
      END IF;
    END $$;
  `);
}

const scopePersonaHistory: MigrationFn<QueryInterface> = async ({ context }) => {
  await context.addColumn("saved_opportunities", "user_type", {
    type: DataTypes.STRING(32),
    allowNull: true,
  });
  await context.sequelize.query(`
    UPDATE "saved_opportunities" AS saved
    SET "user_type" = users."user_type"
    FROM "users" AS users
    WHERE users."id" = saved."user_id"
  `);
  await failIfUnresolved(context, "saved_opportunities");
  await context.changeColumn("saved_opportunities", "user_type", {
    type: DataTypes.STRING(32),
    allowNull: false,
  });
  await context.removeConstraint("saved_opportunities", "uq_saved_opportunity");
  await context.addConstraint("saved_opportunities", {
    fields: ["user_id", "user_type", "opportunity_id"],
    type: "unique",
    name: "uq_saved_opportunity_persona",
  });
  await context.sequelize.query(`
    ALTER TABLE "saved_opportunities"
    ADD CONSTRAINT "saved_opportunities_user_type_check"
    CHECK ("user_type" IN ('ENTREPRENEUR', 'UMKM_EXISTING'))
  `);
  await context.addIndex("saved_opportunities", {
    fields: ["user_id", "user_type", { name: "created_at", order: "DESC" }],
    name: "saved_opportunities_user_type_created_at_idx",
  });

  await context.addColumn("user_opportunity_analyses", "user_type", {
    type: DataTypes.STRING(32),
    allowNull: true,
  });
  await context.sequelize.query(`
    UPDATE "user_opportunity_analyses" AS analysis
    SET "user_type" = CASE
      WHEN analysis."ai_analysis"->>'userType' IN ('ENTREPRENEUR', 'UMKM_EXISTING')
        THEN analysis."ai_analysis"->>'userType'
      ELSE users."user_type"
    END
    FROM "users" AS users
    WHERE users."id" = analysis."user_id"
  `);
  await failIfUnresolved(context, "user_opportunity_analyses");
  await context.changeColumn("user_opportunity_analyses", "user_type", {
    type: DataTypes.STRING(32),
    allowNull: false,
  });
  await context.sequelize.query(`
    ALTER TABLE "user_opportunity_analyses"
    ADD CONSTRAINT "user_opportunity_analyses_user_type_check"
    CHECK ("user_type" IN ('ENTREPRENEUR', 'UMKM_EXISTING'))
  `);
  await context.removeIndex("user_opportunity_analyses", "user_opportunity_analyses_user_opportunity_generated_at_idx");
  await context.addIndex("user_opportunity_analyses", {
    fields: ["user_id", "user_type", "opportunity_id", { name: "generated_at", order: "DESC" }],
    name: "user_opportunity_analyses_user_type_opportunity_generated_at_idx",
  });
};

const unScopePersonaHistory: MigrationFn<QueryInterface> = async ({ context }) => {
  await context.removeIndex("user_opportunity_analyses", "user_opportunity_analyses_user_type_opportunity_generated_at_idx");
  await context.addIndex("user_opportunity_analyses", {
    fields: ["user_id", "opportunity_id", { name: "generated_at", order: "DESC" }],
    name: "user_opportunity_analyses_user_opportunity_generated_at_idx",
  });
  await context.removeConstraint("user_opportunity_analyses", "user_opportunity_analyses_user_type_check");
  await context.changeColumn("user_opportunity_analyses", "user_type", {
    type: DataTypes.STRING(32),
    allowNull: true,
  });
  await context.removeColumn("user_opportunity_analyses", "user_type");

  await context.removeIndex("saved_opportunities", "saved_opportunities_user_type_created_at_idx");
  await context.removeConstraint("saved_opportunities", "saved_opportunities_user_type_check");
  await context.removeConstraint("saved_opportunities", "uq_saved_opportunity_persona");
  await context.addConstraint("saved_opportunities", {
    fields: ["user_id", "opportunity_id"],
    type: "unique",
    name: "uq_saved_opportunity",
  });
  await context.removeColumn("saved_opportunities", "user_type");
};

export const up = scopePersonaHistory;
export const down = unScopePersonaHistory;
