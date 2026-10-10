import bcrypt from "bcryptjs";

const COST = 12;

export const hashPassword = (plain: string) => bcrypt.hash(plain, COST);
export const verifyPassword = (plain: string, hash: string) => bcrypt.compare(plain, hash);

// Compared against when the account does not exist, so response time doesn't reveal it.
let dummyHash: Promise<string> | undefined;
export async function burnPasswordCheck(plain: string): Promise<void> {
  dummyHash ??= bcrypt.hash("not-a-real-password", COST);
  await bcrypt.compare(plain, await dummyHash);
}
