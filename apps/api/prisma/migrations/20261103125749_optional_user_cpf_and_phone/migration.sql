-- Signup stopped asking for CPF and phone: both become optional. The format CHECKs
-- (users_cpf_format_check, users_phone_format_check) still apply when a value is set, and
-- the unique index on cpf allows any number of NULLs.

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "cpf" DROP NOT NULL,
ALTER COLUMN "phone" DROP NOT NULL;
