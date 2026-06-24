UPDATE "items"
SET
	"decision" = 'undecided',
	"updated_at" = now()
WHERE "archived_at" IS NULL
	AND "decision" = 'keep';
