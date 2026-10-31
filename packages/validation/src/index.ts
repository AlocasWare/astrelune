import { z } from "zod";

const safeHref = (value: string) => {
  const href = value.trim();
  if (
    href &&
    !href.startsWith("//") &&
    !href.includes("\\") &&
    !/[\u0000-\u0020]/u.test(href) &&
    !/^[a-z][a-z0-9+.-]*:/iu.test(href)
  )
    return true;
  try {
    const url = new URL(href);
    return (
      ["http:", "https:", "mailto:", "tel:"].includes(url.protocol) &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
};

const boldMarkSchema = z.object({ type: z.literal("bold") }).strict();
const italicMarkSchema = z.object({ type: z.literal("italic") }).strict();
const linkMarkSchema = z
  .object({
    type: z.literal("link"),
    attrs: z
      .object({
        href: z.string().trim().min(1).max(2048).refine(safeHref, "Unsupported or unsafe link URL"),
        target: z.enum(["_blank", "_self"]).nullable().optional(),
        rel: z
          .string()
          .max(128)
          .refine((value) =>
            value
              .split(/\s+/u)
              .every((token) => ["noopener", "noreferrer", "nofollow", "ugc"].includes(token)),
          )
          .optional(),
      })
      .strict(),
  })
  .strict();
const markSchema = z.union([boldMarkSchema, italicMarkSchema, linkMarkSchema]);

const textNodeSchema = z
  .object({
    type: z.literal("text"),
    text: z.string().min(1).max(100_000),
    marks: z.array(markSchema).max(8).optional(),
  })
  .strict();

const paragraphSchema = z
  .object({
    type: z.literal("paragraph"),
    content: z.array(textNodeSchema).max(10_000).optional(),
  })
  .strict();

const headingSchema = z
  .object({
    type: z.literal("heading"),
    attrs: z.object({ level: z.number().int().min(1).max(6) }).strict(),
    content: z.array(textNodeSchema).max(10_000).optional(),
  })
  .strict();

type EditorBlock =
  | z.infer<typeof paragraphSchema>
  | z.infer<typeof headingSchema>
  | { type: "horizontalRule" }
  | {
      type: "bulletList" | "orderedList" | "blockquote";
      attrs?: { start?: number; type?: string | null };
      content: EditorListItem[] | EditorBlock[];
    };
type EditorListItem = { type: "listItem"; content: EditorBlock[] };

let editorBlockSchema: z.ZodType<EditorBlock>;
const editorListItemSchema: z.ZodType<EditorListItem> = z.lazy(() =>
  z
    .object({
      type: z.literal("listItem"),
      content: z.array(editorBlockSchema).min(1).max(1000),
    })
    .strict(),
);

editorBlockSchema = z.lazy(() =>
  z.union([
    paragraphSchema,
    headingSchema,
    z.object({ type: z.literal("horizontalRule") }).strict(),
    z
      .object({
        type: z.literal("bulletList"),
        content: z.array(editorListItemSchema).min(1).max(1000),
      })
      .strict(),
    z
      .object({
        type: z.literal("orderedList"),
        attrs: z
          .object({
            start: z.number().int().min(1).optional(),
            type: z.string().max(32).nullable().optional(),
          })
          .strict()
          .optional(),
        content: z.array(editorListItemSchema).min(1).max(1000),
      })
      .strict(),
    z
      .object({
        type: z.literal("blockquote"),
        content: z.array(editorBlockSchema).min(1).max(1000),
      })
      .strict(),
  ]),
);

export const editorDocumentSchema = z
  .object({
    type: z.literal("doc"),
    content: z.array(editorBlockSchema).max(10_000),
  })
  .strict();

export type EditorDocument = z.infer<typeof editorDocumentSchema>;

export function parseEditorDocument(input: unknown): EditorDocument {
  let serialized: string;
  try {
    serialized = JSON.stringify(input);
  } catch {
    throw new z.ZodError([
      { code: "custom", path: [], message: "Editor content must be JSON serializable." },
    ]);
  }
  if (typeof serialized !== "string") {
    throw new z.ZodError([
      { code: "custom", path: [], message: "Editor content must be a JSON object." },
    ]);
  }
  if (serialized.length > 1_000_000) {
    throw new z.ZodError([
      { code: "custom", path: [], message: "Editor content exceeds the size limit." },
    ]);
  }

  const stack: Array<{ value: unknown; depth: number }> = [{ value: input, depth: 0 }];
  let nodeCount = 0;
  const seen = new WeakSet<object>();
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (!current.value || typeof current.value !== "object") continue;
    if (seen.has(current.value)) {
      throw new z.ZodError([
        { code: "custom", path: [], message: "Editor content cannot contain cycles." },
      ]);
    }
    seen.add(current.value);
    if (current.depth > 64 || ++nodeCount > 20_000) {
      throw new z.ZodError([
        { code: "custom", path: [], message: "Editor content exceeds structural limits." },
      ]);
    }
    for (const child of Object.values(current.value))
      stack.push({ value: child, depth: current.depth + 1 });
  }
  return editorDocumentSchema.parse(input);
}

const trimmedText = (max: number) => z.string().trim().min(1).max(max);
const optionalDescription = (max: number) => z.string().trim().max(max).optional();
const uuidSchema = z.string().uuid();

export const createProjectSchema = z
  .object({
    title: trimmedText(200),
    description: optionalDescription(2000),
  })
  .strict();
export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export const createDocumentSchema = z
  .object({
    title: trimmedText(200),
    kind: z.enum(["FOLDER", "CHAPTER", "SCENE", "NOTE", "RESEARCH"]),
    parentId: uuidSchema.nullable().optional(),
    position: z.number().int().min(0).optional(),
  })
  .strict();
export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;

export const saveDocumentSchema = z
  .object({
    contentVersion: z.number().int().nonnegative(),
    contentSchemaVersion: z.number().int().positive(),
    content: z.record(z.string(), z.unknown()),
  })
  .strict();
export type SaveDocumentInput = z.infer<typeof saveDocumentSchema>;

export const createWorldSchema = z
  .object({
    name: trimmedText(200),
    description: optionalDescription(4000),
  })
  .strict();
export type CreateWorldInput = z.infer<typeof createWorldSchema>;

export const createWorldEntrySchema = z
  .object({
    name: trimmedText(200),
    kind: z.enum([
      "CHARACTER",
      "LOCATION",
      "ORGANIZATION",
      "OBJECT",
      "EVENT",
      "SPECIES",
      "CONCEPT",
      "CUSTOM",
    ]),
    parentId: uuidSchema.nullable().optional(),
    summary: optionalDescription(2000),
    content: z.record(z.string(), z.unknown()),
  })
  .strict();
export type CreateWorldEntryInput = z.infer<typeof createWorldEntrySchema>;

export const deleteAccountSchema = z
  .object({
    confirmation: z.literal("DELETE MY ACCOUNT"),
    password: z.string().min(1).optional(),
  })
  .strict();
export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;

export const deleteProjectSchema = z.object({ confirmation: z.literal("DELETE PROJECT") }).strict();
export type DeleteProjectInput = z.infer<typeof deleteProjectSchema>;

export const deleteDocumentSchema = z
  .object({ confirmation: z.literal("DELETE DOCUMENT") })
  .strict();
export type DeleteDocumentInput = z.infer<typeof deleteDocumentSchema>;

export const deleteWorldSchema = z.object({ confirmation: z.literal("DELETE WORLD") }).strict();
export type DeleteWorldInput = z.infer<typeof deleteWorldSchema>;

export const themePreferenceSchema = z.enum(["SYSTEM", "LIGHT", "DARK"]);

export const updateUserPreferencesSchema = z
  .object({
    theme: themePreferenceSchema.optional(),
    editorFontFamily: trimmedText(40).optional(),
    editorFontSize: z.number().int().min(12).max(32).optional(),
    editorLineHeight: z.number().min(1).max(3).optional(),
    focusModeDefault: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "At least one preference field is required.");
export type UpdateUserPreferencesInput = z.infer<typeof updateUserPreferencesSchema>;

export const documentRouteParamsSchema = z.object({ documentId: uuidSchema }).strict();
export const worldRouteParamsSchema = z.object({ worldId: uuidSchema }).strict();
export const projectRouteParamsSchema = z.object({ projectId: uuidSchema }).strict();
export const createWorldEntryRelationshipSchema = z
  .object({
    sourceEntryId: uuidSchema,
    targetEntryId: uuidSchema,
    relationshipType: trimmedText(80),
    description: optionalDescription(2000),
  })
  .strict()
  .refine(
    (value) => value.sourceEntryId !== value.targetEntryId,
    "A relationship cannot link an entry to itself.",
  );
export type CreateWorldEntryRelationshipInput = z.infer<typeof createWorldEntryRelationshipSchema>;

export const updateWorldEntryRelationshipSchema = z
  .object({
    relationshipType: trimmedText(80).optional(),
    description: optionalDescription(2000),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "At least one relationship field is required.");
export type UpdateWorldEntryRelationshipInput = z.infer<typeof updateWorldEntryRelationshipSchema>;
export const updateWorldSchema = z
  .object({
    name: trimmedText(200).optional(),
    description: optionalDescription(4000),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "At least one world field is required.");
export type UpdateWorldInput = z.infer<typeof updateWorldSchema>;

export const updateWorldEntrySchema = z
  .object({
    name: trimmedText(200).optional(),
    kind: z
      .enum([
        "CHARACTER",
        "LOCATION",
        "ORGANIZATION",
        "OBJECT",
        "EVENT",
        "SPECIES",
        "CONCEPT",
        "CUSTOM",
      ])
      .optional(),
    parentId: uuidSchema.nullable().optional(),
    summary: optionalDescription(2000),
    content: z.record(z.string(), z.unknown()).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "At least one world-entry field is required.");
export type UpdateWorldEntryInput = z.infer<typeof updateWorldEntrySchema>;
export const moveDocumentSchema = z
  .object({
    parentId: uuidSchema.nullable().optional(),
    position: z.number().int().min(0).optional(),
    title: trimmedText(200).optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.parentId !== undefined || value.position !== undefined || value.title !== undefined,
    "At least one document field is required.",
  );
export type MoveDocumentInput = z.infer<typeof moveDocumentSchema>;
export const updateProjectSchema = z
  .object({
    title: trimmedText(200).optional(),
    description: optionalDescription(2000),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "At least one project field is required.");
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

export const loginSchema = z
  .object({
    email: z.string().trim().email().max(320),
    password: z.string().min(1).max(128),
  })
  .strict();
export type LoginInput = z.infer<typeof loginSchema>;
export const registerUserSchema = z
  .object({
    email: z.string().trim().email().max(320),
    displayName: trimmedText(80),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters long.")
      .max(128, "Password must be at most 128 characters long.")
      .refine(
        (value) =>
          value.toLowerCase() !== value.toUpperCase() &&
          Array.from(value).some((character) => character >= "0" && character <= "9"),
        "Password must include at least one letter and one number.",
      ),
    confirmPassword: z.string().min(1, "Password confirmation is required."),
  })
  .strict()
  .refine((value) => value.password === value.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });
export type RegisterUserInput = z.infer<typeof registerUserSchema>;

export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must use YYYY-MM-DD format.")
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`)), "Invalid date.");

export const writingPeriodSchema = z.enum(["DAILY", "WEEKLY"]);

export const createWritingGoalSchema = z
  .object({
    period: writingPeriodSchema,
    targetWords: z.number().int().min(1).max(1_000_000),
    startsAt: dateSchema,
    endsAt: dateSchema.nullable().optional(),
    projectId: uuidSchema.nullable().optional(),
  })
  .strict()
  .refine(
    (value) => !value.endsAt || value.endsAt >= value.startsAt,
    "End date must be on or after the start date.",
  );
export type CreateWritingGoalInput = z.infer<typeof createWritingGoalSchema>;

export const updateWritingGoalSchema = z
  .object({
    period: writingPeriodSchema.optional(),
    targetWords: z.number().int().min(1).max(1_000_000).optional(),
    startsAt: dateSchema.optional(),
    endsAt: dateSchema.nullable().optional(),
    projectId: uuidSchema.nullable().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "At least one goal field is required.")
  .refine(
    (value) => !value.startsAt || !value.endsAt || value.endsAt >= value.startsAt,
    "End date must be on or after the start date.",
  );
export type UpdateWritingGoalInput = z.infer<typeof updateWritingGoalSchema>;

export const createWritingActivitySchema = z
  .object({
    idempotencyKey: z.string().trim().min(1).max(128),
    projectId: uuidSchema.nullable().optional(),
    documentId: uuidSchema.nullable().optional(),
    activityDate: dateSchema.optional(),
    wordsAdded: z.number().int().min(0).max(1_000_000).optional(),
  })
  .strict();
export type CreateWritingActivityInput = z.infer<typeof createWritingActivitySchema>;

export const goalRouteParamsSchema = z.object({ goalId: uuidSchema }).strict();
export const activityQuerySchema = z
  .object({
    projectId: uuidSchema.optional(),
    from: dateSchema.optional(),
    to: dateSchema.optional(),
  })
  .strict();
