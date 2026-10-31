const assert = require("node:assert/strict");
const { describe, it } = require("node:test");
const {
  createDocumentSchema,
  createProjectSchema,
  deleteAccountSchema,
  deleteDocumentSchema,
  editorDocumentSchema,
  parseEditorDocument,
  registerUserSchema,
  saveDocumentSchema,
} = require("../dist/index.js");

describe("shared validation schemas", () => {
  it("accepts the supported ProseMirror blocks, marks, lists, and safe links", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Hello", marks: [{ type: "bold" }, { type: "italic" }] }],
        },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Chapter" }] },
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [{ type: "paragraph", content: [{ type: "text", text: "Point" }] }],
            },
          ],
        },
        {
          type: "orderedList",
          attrs: { start: 2 },
          content: [
            {
              type: "listItem",
              content: [{ type: "paragraph", content: [{ type: "text", text: "Step" }] }],
            },
          ],
        },
        {
          type: "blockquote",
          content: [{ type: "paragraph", content: [{ type: "text", text: "Quote" }] }],
        },
        { type: "horizontalRule" },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "link",
              marks: [
                {
                  type: "link",
                  attrs: {
                    href: "https://example.com/path",
                    target: "_blank",
                    rel: "noopener noreferrer",
                  },
                },
              ],
            },
          ],
        },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "internal",
              marks: [{ type: "link", attrs: { href: "../chapter-2" } }],
            },
          ],
        },
      ],
    };
    assert.deepEqual(parseEditorDocument(doc), doc);
    assert.equal(editorDocumentSchema.safeParse(doc).success, true);
  });

  it("rejects embeds, HTML, unsupported marks, unsafe links, extra editor fields, and oversized content", () => {
    for (const invalid of [
      { type: "doc", content: [{ type: "image", attrs: { src: "https://example.com/x.png" } }] },
      { type: "doc", content: [{ type: "html", content: "<script>alert(1)</script>" }] },
      { type: "doc", content: [{ type: "listItem", content: [{ type: "paragraph" }] }] },
      {
        type: "doc",
        content: [{ type: "heading", content: [{ type: "text", text: "missing level" }] }],
      },
      {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "x", marks: [{ type: "highlight" }] }],
          },
        ],
      },
      {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "x",
                marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }],
              },
            ],
          },
        ],
      },
      { type: "doc", extra: true, content: [] },
    ])
      assert.equal(editorDocumentSchema.safeParse(invalid).success, false);

    assert.throws(() =>
      parseEditorDocument({
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "text", text: "x".repeat(1_000_001) }] }],
      }),
    );
  });

  it("rejects unknown security fields, invalid versions, and destructive requests without exact confirmations", () => {
    assert.equal(
      createProjectSchema.safeParse({ title: "  Draft  ", ownerId: "attacker" }).success,
      false,
    );
    assert.deepEqual(createProjectSchema.parse({ title: "  Draft  " }), { title: "Draft" });
    assert.equal(
      createDocumentSchema.safeParse({ title: "x", kind: "FOLDER", position: -1 }).success,
      false,
    );
    assert.equal(
      createDocumentSchema.safeParse({ title: "x", kind: "FOLDER", ownerId: "attacker" }).success,
      false,
    );
    assert.equal(
      saveDocumentSchema.safeParse({ contentVersion: -1, contentSchemaVersion: 1, content: {} })
        .success,
      false,
    );
    assert.equal(
      saveDocumentSchema.safeParse({
        contentVersion: 1,
        contentSchemaVersion: 1,
        content: {},
        wordCount: 99,
      }).success,
      false,
    );
    assert.equal(
      deleteAccountSchema.safeParse({ confirmation: "DELETE MY ACCOUNT", ownerId: "attacker" })
        .success,
      false,
    );
    assert.equal(deleteDocumentSchema.safeParse({ confirmation: "DELETE PROJECT" }).success, false);

    assert.equal(
      registerUserSchema.safeParse({
        email: "person@example.com",
        displayName: "Person",
        password: "password1",
        confirmPassword: "password1",
      }).success,
      true,
    );
    assert.equal(
      registerUserSchema.safeParse({
        email: "person@example.com",
        displayName: "Person",
        password: "password1",
        confirmPassword: "different",
      }).success,
      false,
    );
  });
});
