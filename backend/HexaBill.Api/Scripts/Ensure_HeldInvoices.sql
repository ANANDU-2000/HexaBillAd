-- Create HeldInvoices if missing (migration 20260217111415 may have been marked applied without table on Render)
CREATE TABLE IF NOT EXISTS "HeldInvoices" (
    "Id" SERIAL PRIMARY KEY,
    "TenantId" INTEGER NOT NULL,
    "UserId" INTEGER NOT NULL,
    "Name" VARCHAR(200) NOT NULL,
    "InvoiceData" TEXT NOT NULL,
    "CreatedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT "FK_HeldInvoices_Users_UserId" FOREIGN KEY ("UserId") REFERENCES "Users" ("Id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "IX_HeldInvoices_UserId" ON "HeldInvoices" ("UserId");
