-- From July 2026 the CNPJ can be alphanumeric: 12 characters of [0-9A-Z] followed by two
-- numeric check digits. Stored uppercase, without punctuation.
ALTER TABLE "brokers" DROP CONSTRAINT "brokers_document_format_check";
ALTER TABLE "brokers" ADD CONSTRAINT "brokers_document_format_check" CHECK (
  "document" IS NULL
  OR ("type" = 'INDIVIDUAL' AND "document" ~ '^[0-9]{11}$')
  OR ("type" = 'COMPANY' AND "document" ~ '^[0-9A-Z]{12}[0-9]{2}$')
);
