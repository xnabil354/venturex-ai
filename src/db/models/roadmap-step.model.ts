import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
  type NonAttribute,
} from "sequelize";

import type { Roadmap } from "./roadmap.model";
import { getSequelize } from "../sequelize";

declare global {
  var __venturexRoadmapStepModel: typeof RoadmapStep | undefined;
}

export class RoadmapStep extends Model<InferAttributes<RoadmapStep>, InferCreationAttributes<RoadmapStep>> {
  declare id: CreationOptional<string>;
  declare roadmapId: string;
  declare sequence: number;
  declare stage: string;
  declare action: string;
  declare objective: string;
  declare timeline: string;
  declare expectedOutput: string;
  declare createdAt: CreationOptional<Date>;
  declare roadmap: NonAttribute<Roadmap> | undefined;
}

export function getRoadmapStepModel(): typeof RoadmapStep {
  if (globalThis.__venturexRoadmapStepModel) return globalThis.__venturexRoadmapStepModel;
  RoadmapStep.init({
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    roadmapId: { type: DataTypes.UUID, allowNull: false, field: "roadmap_id" },
    sequence: { type: DataTypes.SMALLINT, allowNull: false },
    stage: { type: DataTypes.STRING(120), allowNull: false },
    action: { type: DataTypes.TEXT, allowNull: false },
    objective: { type: DataTypes.TEXT, allowNull: false },
    timeline: { type: DataTypes.STRING(120), allowNull: false },
    expectedOutput: { type: DataTypes.TEXT, allowNull: false, field: "expected_output" },
    createdAt: { type: DataTypes.DATE, allowNull: false, field: "created_at" },
  }, {
    sequelize: getSequelize(),
    tableName: "roadmap_steps",
    timestamps: false,
    underscored: true,
    indexes: [{ unique: true, name: "roadmap_steps_roadmap_sequence_uq", fields: ["roadmapId", "sequence"] }],
  });
  globalThis.__venturexRoadmapStepModel = RoadmapStep;
  return RoadmapStep;
}
