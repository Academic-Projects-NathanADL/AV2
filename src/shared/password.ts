import bcrypt from "bcryptjs";

const WORK_FACTOR = 12;

export const hashPassword = (password: string) => bcrypt.hash(password, WORK_FACTOR);
export const verifyPassword = (password: string, hash: string) => bcrypt.compare(password, hash);
