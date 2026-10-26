export function normalizarCnpj(value: string): string {
  if (!/^[\d.\/-]+$/.test(value)) throw new Error("CNPJ deve conter somente números e caracteres de formatação.");
  const cnpj = value.replace(/\D/g, "");
  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) throw new Error("CNPJ inválido.");

  const digito = (base: string, pesos: number[]) => {
    const soma = base.split("").reduce((total, n, i) => total + Number(n) * pesos[i]!, 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  const d1 = digito(cnpj.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = digito(cnpj.slice(0, 12) + d1, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  if (Number(cnpj[12]) !== d1 || Number(cnpj[13]) !== d2) throw new Error("Dígitos verificadores do CNPJ não conferem.");
  return cnpj;
}
