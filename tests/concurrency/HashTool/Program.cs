// Prints a bcrypt hash of $HEXABILL_HASH_INPUT (synthetic local password). Used by run.ps1 to reset passwords on the local DB.
Console.Write(BCrypt.Net.BCrypt.HashPassword(Environment.GetEnvironmentVariable("HEXABILL_HASH_INPUT") ?? throw new InvalidOperationException("no input")));
