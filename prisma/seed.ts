import "dotenv/config";
import { PrismaClient, Papel, TipoOrganizacao, TipoEquipamento, EstadoFisico, StatusEquipamento, StatusLote, TipoMovimentacao } from "@prisma/client";
import { hashPassword } from "../src/shared/password";

const prisma = new PrismaClient();

async function main() {
  await prisma.parametroFinanceiro.upsert({
    where: { id: 1 },
    create: { id: 1, aliquotaImpostoBps: 0, coeficienteDepreciacaoAnualBps: 2000 },
    update: {},
  });
  const users = [
    { login: "admin@greencode.local", nomeCompleto: "Admin Circuito Vivo", papel: Papel.ADMINISTRADOR, senha: "CircuitoVivo!2026" },
    { login: "operador@greencode.local", nomeCompleto: "Marina Cadastro", papel: Papel.OPERADOR_CADASTRO, senha: "Operador!2026" },
    { login: "gestor@greencode.local", nomeCompleto: "Ravi Almoxarifado", papel: Papel.GESTOR_ALMOXARIFADO, senha: "Gestor!2026" },
    { login: "auditor@greencode.local", nomeCompleto: "Lia Auditoria", papel: Papel.AUDITOR, senha: "Auditor!2026" },
  ];
  const contas = new Map<string, string>();
  for (const user of users) {
    const row = await prisma.usuario.upsert({
      where: { login: user.login },
      create: { login: user.login, nomeCompleto: user.nomeCompleto, papel: user.papel, senhaHash: await hashPassword(user.senha) },
      update: { nomeCompleto: user.nomeCompleto, papel: user.papel, ativo: true },
    });
    contas.set(user.login, row.id);
  }

  const organizations = [
    { cnpj: "11222333000181", razaoSocial: "Aurora Financeira S.A.", tipo: TipoOrganizacao.BANCARIO, contract: "CV-AUR-2026" },
    { cnpj: "19131243000197", razaoSocial: "Hospital Horizonte Vivo", tipo: TipoOrganizacao.SAUDE, contract: "CV-HHV-2026" },
    { cnpj: "33000167000101", razaoSocial: "Instituto Aberto de Tecnologia", tipo: TipoOrganizacao.EDUCACAO, contract: "CV-IAT-2026" },
  ];
  const orgs = [];
  for (const item of organizations) {
    const org = await prisma.organizacao.upsert({
      where: { cnpj: item.cnpj },
      create: { cnpj: item.cnpj, razaoSocial: item.razaoSocial, tipo: item.tipo },
      update: { razaoSocial: item.razaoSocial, tipo: item.tipo, ativa: true },
    });
    await prisma.contrato.upsert({
      where: { organizacaoId: org.id },
      create: { organizacaoId: org.id, numero: item.contract, dataInicio: new Date("2026-01-01T00:00:00Z"), prazoArmazenamentoDias: 90 },
      update: { numero: item.contract, prazoArmazenamentoDias: 90, ativo: true },
    });
    orgs.push(org);
  }

  const gestorId = contas.get("gestor@greencode.local")!;
  const loteStatuses = [StatusLote.EM_TRIAGEM, StatusLote.TRIADO, StatusLote.ENCERRADO];
  const lotes = [
    { codigo: "CV-DEMO-AURORA", org: orgs[0]!, invoice: "NF-AUR-001", carrier: "Rota Limpa Logística" },
    { codigo: "CV-DEMO-HORIZONTE", org: orgs[1]!, invoice: "NF-HHV-014", carrier: "Rota Limpa Logística" },
    { codigo: "CV-DEMO-INSTITUTO", org: orgs[2]!, invoice: "NF-IAT-008", carrier: "Ciclo Norte Transportes" },
  ];
  for (const [index, item] of lotes.entries()) {
    const lote = await prisma.lote.upsert({
      where: { codigoPublico: item.codigo },
      create: { codigoPublico: item.codigo, organizacaoId: item.org.id, notaFiscal: item.invoice, transportadora: item.carrier, dataEntrada: new Date(`2026-09-${18 + index}T12:00:00Z`), status: loteStatuses[index]! },
      update: { organizacaoId: item.org.id, notaFiscal: item.invoice, transportadora: item.carrier, status: loteStatuses[index]! },
    });
    const samples = index === 0
      ? [
          { codigo: `${item.codigo}-01`, tipo: TipoEquipamento.TERMINAL_BANCARIO, estado: EstadoFisico.BOM, status: StatusEquipamento.REUTILIZADO, destino: "Recondicionamento para cooperativa de crédito" },
          { codigo: `${item.codigo}-02`, tipo: TipoEquipamento.DESKTOP, estado: EstadoFisico.REGULAR, status: StatusEquipamento.RECICLADO, destino: "Recicladora certificada de placas e metais" },
          { codigo: `${item.codigo}-03`, tipo: TipoEquipamento.MONITOR, estado: EstadoFisico.RUIM, status: StatusEquipamento.AGUARDANDO_TRIAGEM, destino: null },
        ]
      : index === 1
        ? [{ codigo: `${item.codigo}-01`, tipo: TipoEquipamento.NOTEBOOK, estado: EstadoFisico.BOM, status: StatusEquipamento.EM_RECUPERACAO, destino: null }]
        : [{ codigo: `${item.codigo}-01`, tipo: TipoEquipamento.SERVIDOR, estado: EstadoFisico.INSERVIVEL, status: StatusEquipamento.DESCARTE_SEGURO, destino: "Descaracterização e destinação licenciada" }];

    for (const [sampleIndex, sample] of samples.entries()) {
      const equipamento = await prisma.equipamento.upsert({
        where: { codigoRastreio: sample.codigo },
        create: {
          codigoRastreio: sample.codigo,
          codigoBarras: sampleIndex === 0 && sample.status !== StatusEquipamento.AGUARDANDO_TRIAGEM ? `BC-${item.codigo.slice(-5)}-${index}` : null,
          loteId: lote.id,
          tipo: sample.tipo,
          estadoFisico: sample.estado,
          status: sample.status,
          triagemCompleta: sample.status !== StatusEquipamento.AGUARDANDO_TRIAGEM,
          destinoFinal: sample.destino,
        },
        update: { loteId: lote.id, tipo: sample.tipo, estadoFisico: sample.estado, status: sample.status, triagemCompleta: sample.status !== StatusEquipamento.AGUARDANDO_TRIAGEM, destinoFinal: sample.destino },
      });
      if ((await prisma.movimentacao.count({ where: { equipamentoId: equipamento.id } })) === 0) {
        const trilha: Array<{ tipo: TipoMovimentacao; anterior: StatusEquipamento | null; novo: StatusEquipamento; justificativa?: string }> = [
          { tipo: TipoMovimentacao.ENTRADA, anterior: null, novo: StatusEquipamento.AGUARDANDO_TRIAGEM },
        ];
        if (sample.status !== StatusEquipamento.AGUARDANDO_TRIAGEM) {
          trilha.push({ tipo: TipoMovimentacao.TRIAGEM, anterior: StatusEquipamento.AGUARDANDO_TRIAGEM, novo: StatusEquipamento.TRIADO, justificativa: "Identificação, condição e componentes conferidos." });
        }
        if (sample.status === StatusEquipamento.EM_RECUPERACAO || sample.status === StatusEquipamento.REUTILIZADO) {
          trilha.push({ tipo: TipoMovimentacao.ENCAMINHAMENTO, anterior: StatusEquipamento.TRIADO, novo: StatusEquipamento.DESMONTE, justificativa: "Separação dos módulos recuperáveis." });
          trilha.push({ tipo: TipoMovimentacao.RECUPERACAO, anterior: StatusEquipamento.DESMONTE, novo: StatusEquipamento.EM_RECUPERACAO, justificativa: "Módulos enviados para recondicionamento." });
        }
        const statusFinalSet = new Set<StatusEquipamento>([StatusEquipamento.REUTILIZADO, StatusEquipamento.RECICLADO, StatusEquipamento.DESCARTE_SEGURO]);
        if (statusFinalSet.has(sample.status)) {
          const anterior = sample.status === StatusEquipamento.REUTILIZADO ? StatusEquipamento.EM_RECUPERACAO : StatusEquipamento.TRIADO;
          trilha.push({ tipo: TipoMovimentacao.DESTINO_FINAL, anterior, novo: sample.status, justificativa: sample.destino ?? "Destino registrado no passaporte." });
        }
        for (const movimento of trilha) {
          await prisma.movimentacao.create({
            data: {
              equipamentoId: equipamento.id,
              usuarioId: gestorId,
              tipo: movimento.tipo,
              statusAnterior: movimento.anterior,
              statusNovo: movimento.novo,
              justificativa: movimento.justificativa ?? null,
            },
          });
        }
      }
    }
  }

  console.log("Seed Circuito Vivo concluído: 4 perfis, 3 organizações e 5 passaportes de demonstração.");
}

main().catch((error: unknown) => {
  console.error("Falha ao criar seed:", error);
  process.exitCode = 1;
}).finally(async () => prisma.$disconnect());
