import { version as simVersion } from "@trajectonomics/sim/package.json"
import { z } from "zod"
import { acceptedScenarioSchemaVersion, refusalOf, scenarioProblems } from "./document"
import {
	SCENARIO_SHAPE_REQUIRED,
	scenarioExample,
	scenarioShapeDescription,
	scenarioShapeProperties,
} from "./shape"

/**
 * The document form's schema and `traj schema`'s view of it (ADR-0020). It accepts any JSON value
 * and defers to `sim-core`, so `NOT_AN_OBJECT` and `UNSUPPORTED_SCHEMA_VERSION` are the core's
 * codes and this layer never rejects a document first. Its JSON Schema states the shape the core
 * accepts, with its units and closed values, plus one worked example: it is documentation, never a
 * second validator (ADR-0024), and the tests beside `shape/` probe every path of it against the pin.
 */
const version = acceptedScenarioSchemaVersion()

export const scenarioDocument: z.ZodType<unknown> = z
	.unknown()
	.superRefine((value, ctx) => {
		for (const problem of scenarioProblems(value)) {
			const refusal = refusalOf(problem, "document")
			ctx.addIssue({
				code: "custom",
				message: refusal.message,
				path: [...problem.segments],
				params: {
					code: problem.code,
					...(refusal.hint === undefined ? {} : { hint: refusal.hint }),
				},
			})
		}
	})
	.meta({
		type: "object",
		properties: scenarioShapeProperties(version),
		required: [...SCENARIO_SHAPE_REQUIRED],
		additionalProperties: false,
		description: scenarioShapeDescription(simVersion),
		// An example the pin cannot stamp is not a document this build accepts, so it is left out.
		...(version === undefined ? {} : { examples: [scenarioExample(version)] }),
	})
