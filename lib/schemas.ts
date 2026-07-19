import Joi from "joi";

const maxBlockChars = 20_000;
const maxOperations = 250;

export const registerSchema = Joi.object({
  name: Joi.string().trim().min(2).max(80).required(),
  email: Joi.string().email().max(160).required(),
  password: Joi.string().min(10).max(128).required()
});

export const loginSchema = Joi.object({
  email: Joi.string().email().max(160).required(),
  password: Joi.string().min(10).max(128).required()
});

const vectorClockSchema = Joi.object().pattern(Joi.string().max(80), Joi.number().integer().min(0).max(1_000_000));

const snapshotSchema = Joi.object({
  id: Joi.string().max(80).required(),
  title: Joi.string().trim().max(120).required(),
  updatedAt: Joi.number().integer().required(),
  clock: vectorClockSchema.required(),
  blocks: Joi.array()
    .max(500)
    .items(
      Joi.object({
        id: Joi.string().max(80).required(),
        text: Joi.string().max(maxBlockChars).allow("").required(),
        updatedAt: Joi.number().integer().required(),
        updatedBy: Joi.string().max(120).required(),
        version: vectorClockSchema.required(),
        deleted: Joi.boolean().optional()
      })
    )
    .required()
});

export const syncSchema = Joi.object({
  documentId: Joi.string().max(80).required(),
  baseClock: vectorClockSchema.required(),
  operations: Joi.array()
    .max(maxOperations)
    .items(
      Joi.object({
        id: Joi.string().max(100).required(),
        documentId: Joi.string().max(80).required(),
        actorId: Joi.string().max(120).required(),
        clientId: Joi.string().max(120).required(),
        kind: Joi.string().valid("UPSERT_BLOCK", "DELETE_BLOCK", "SET_TITLE", "RESTORE_SNAPSHOT").required(),
        lamport: Joi.number().integer().min(1).max(1_000_000).required(),
        createdAt: Joi.number().integer().required(),
        payload: Joi.object({
          blockId: Joi.string().max(80),
          text: Joi.string().max(maxBlockChars).allow(""),
          title: Joi.string().trim().max(120),
          snapshot: snapshotSchema
        }).required()
      })
    )
    .required()
});

export const versionSchema = Joi.object({
  documentId: Joi.string().max(80).required(),
  label: Joi.string().trim().min(2).max(80).required(),
  snapshot: snapshotSchema.required()
});

export const shareSchema = Joi.object({
  documentId: Joi.string().max(80).required(),
  email: Joi.string().email().max(160).required(),
  role: Joi.string().valid("EDITOR", "VIEWER").required()
});

export function validateBody<T>(schema: Joi.ObjectSchema, body: unknown): T {
  const { error, value } = schema.validate(body, {
    abortEarly: false,
    stripUnknown: true,
    convert: true
  });

  if (error) {
    const details = error.details.map((detail) => detail.message.replaceAll("\"", "'"));
    throw new ValidationError(details);
  }

  return value as T;
}

export class ValidationError extends Error {
  constructor(public details: string[]) {
    super("Validation failed");
  }
}
