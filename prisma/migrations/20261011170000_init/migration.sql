-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Papel" AS ENUM ('ADMINISTRADOR', 'OPERADOR_CADASTRO', 'GESTOR_ALMOXARIFADO', 'AUDITOR');

-- CreateEnum
CREATE TYPE "TipoOrganizacao" AS ENUM ('VAREJO', 'SAUDE', 'EDUCACAO', 'BANCARIO', 'INDUSTRIA', 'OUTRO');

-- CreateEnum
CREATE TYPE "StatusLote" AS ENUM ('RECEBIDO', 'EM_TRIAGEM', 'TRIADO', 'ENCERRADO');

-- CreateEnum
CREATE TYPE "TipoEquipamento" AS ENUM ('DESKTOP', 'NOTEBOOK', 'MONITOR', 'TERMINAL_BANCARIO', 'IMPRESSORA', 'SERVIDOR', 'PERIFERICO', 'OUTRO');

-- CreateEnum
CREATE TYPE "EstadoFisico" AS ENUM ('EXCELENTE', 'BOM', 'REGULAR', 'RUIM', 'INSERVIVEL');

-- CreateEnum
CREATE TYPE "StatusEquipamento" AS ENUM ('AGUARDANDO_TRIAGEM', 'TRIADO', 'DESMONTE', 'EM_RECUPERACAO', 'REUTILIZADO', 'RECICLADO', 'DESCARTE_SEGURO');

-- CreateEnum
CREATE TYPE "TipoMovimentacao" AS ENUM ('ENTRADA', 'TRIAGEM', 'ALTERACAO_ESTADO', 'ENCAMINHAMENTO', 'RECUPERACAO', 'DESTINO_FINAL');

-- CreateTable
CREATE TABLE "usuarios" (
    "id" UUID NOT NULL,
    "login" VARCHAR(60) NOT NULL,
    "nome_completo" VARCHAR(160) NOT NULL,
    "senha_hash" VARCHAR(100) NOT NULL,
    "papel" "Papel" NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "versao" INTEGER NOT NULL DEFAULT 1,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizacoes" (
    "id" UUID NOT NULL,
    "cnpj" VARCHAR(14) NOT NULL,
    "razao_social" VARCHAR(180) NOT NULL,
    "tipo" "TipoOrganizacao" NOT NULL,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "versao" INTEGER NOT NULL DEFAULT 1,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organizacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contratos" (
    "id" UUID NOT NULL,
    "organizacao_id" UUID NOT NULL,
    "numero" VARCHAR(60) NOT NULL,
    "data_inicio" DATE NOT NULL,
    "prazo_armazenamento_dias" INTEGER NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "versao" INTEGER NOT NULL DEFAULT 1,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contratos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lotes" (
    "id" UUID NOT NULL,
    "codigo_publico" VARCHAR(24) NOT NULL,
    "organizacao_id" UUID NOT NULL,
    "nota_fiscal" VARCHAR(60) NOT NULL,
    "transportadora" VARCHAR(120) NOT NULL,
    "data_entrada" TIMESTAMPTZ(3) NOT NULL,
    "status" "StatusLote" NOT NULL DEFAULT 'RECEBIDO',
    "versao" INTEGER NOT NULL DEFAULT 1,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipamentos" (
    "id" UUID NOT NULL,
    "codigo_rastreio" VARCHAR(32) NOT NULL,
    "codigo_barras" VARCHAR(80),
    "lote_id" UUID NOT NULL,
    "tipo" "TipoEquipamento" NOT NULL,
    "estado_fisico" "EstadoFisico" NOT NULL,
    "status" "StatusEquipamento" NOT NULL DEFAULT 'AGUARDANDO_TRIAGEM',
    "triagem_completa" BOOLEAN NOT NULL DEFAULT false,
    "destino_final" VARCHAR(180),
    "justificativa" VARCHAR(500),
    "versao" INTEGER NOT NULL DEFAULT 1,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "equipamentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimentacoes" (
    "id" UUID NOT NULL,
    "equipamento_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "tipo" "TipoMovimentacao" NOT NULL,
    "status_anterior" "StatusEquipamento",
    "status_novo" "StatusEquipamento",
    "estado_anterior" "EstadoFisico",
    "estado_novo" "EstadoFisico",
    "justificativa" VARCHAR(500),
    "ocorrido_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "versao" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "movimentacoes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_login_key" ON "usuarios"("login");

-- CreateIndex
CREATE UNIQUE INDEX "organizacoes_cnpj_key" ON "organizacoes"("cnpj");

-- CreateIndex
CREATE UNIQUE INDEX "contratos_organizacao_id_key" ON "contratos"("organizacao_id");

-- CreateIndex
CREATE UNIQUE INDEX "contratos_numero_key" ON "contratos"("numero");

-- CreateIndex
CREATE INDEX "contratos_ativo_data_inicio_idx" ON "contratos"("ativo", "data_inicio");

-- CreateIndex
CREATE UNIQUE INDEX "lotes_codigo_publico_key" ON "lotes"("codigo_publico");

-- CreateIndex
CREATE INDEX "lotes_organizacao_id_data_entrada_idx" ON "lotes"("organizacao_id", "data_entrada");

-- CreateIndex
CREATE INDEX "lotes_status_data_entrada_idx" ON "lotes"("status", "data_entrada");

-- CreateIndex
CREATE UNIQUE INDEX "equipamentos_codigo_rastreio_key" ON "equipamentos"("codigo_rastreio");

-- CreateIndex
CREATE UNIQUE INDEX "equipamentos_codigo_barras_key" ON "equipamentos"("codigo_barras");

-- CreateIndex
CREATE INDEX "equipamentos_lote_id_status_idx" ON "equipamentos"("lote_id", "status");

-- CreateIndex
CREATE INDEX "equipamentos_status_atualizado_em_idx" ON "equipamentos"("status", "atualizado_em");

-- CreateIndex
CREATE INDEX "movimentacoes_equipamento_id_ocorrido_em_idx" ON "movimentacoes"("equipamento_id", "ocorrido_em");

-- CreateIndex
CREATE INDEX "movimentacoes_usuario_id_ocorrido_em_idx" ON "movimentacoes"("usuario_id", "ocorrido_em");

-- AddForeignKey
ALTER TABLE "contratos" ADD CONSTRAINT "contratos_organizacao_id_fkey" FOREIGN KEY ("organizacao_id") REFERENCES "organizacoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lotes" ADD CONSTRAINT "lotes_organizacao_id_fkey" FOREIGN KEY ("organizacao_id") REFERENCES "organizacoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipamentos" ADD CONSTRAINT "equipamentos_lote_id_fkey" FOREIGN KEY ("lote_id") REFERENCES "lotes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentacoes" ADD CONSTRAINT "movimentacoes_equipamento_id_fkey" FOREIGN KEY ("equipamento_id") REFERENCES "equipamentos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentacoes" ADD CONSTRAINT "movimentacoes_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Regras que também devem ser verdadeiras quando a escrita não passa pela API.
ALTER TABLE "organizacoes" ADD CONSTRAINT "organizacoes_cnpj_formato_check" CHECK ("cnpj" ~ '^[0-9]{14}$');
ALTER TABLE "equipamentos" ADD CONSTRAINT "equipamento_desmonte_exige_triagem_check"
  CHECK ("status" <> 'DESMONTE' OR "triagem_completa" = TRUE);
ALTER TABLE "equipamentos" ADD CONSTRAINT "equipamento_triagem_exige_codigo_check"
  CHECK ("status" <> 'TRIADO' OR ("triagem_completa" = TRUE AND "codigo_barras" IS NOT NULL));
ALTER TABLE "equipamentos" ADD CONSTRAINT "equipamento_destino_final_obrigatorio_check"
  CHECK ("status" NOT IN ('REUTILIZADO', 'RECICLADO', 'DESCARTE_SEGURO') OR "destino_final" IS NOT NULL);

-- Dados necessários para a estimativa financeira configurável.
ALTER TABLE "equipamentos" ADD COLUMN "valor_aquisicao_centavos" INTEGER;
ALTER TABLE "equipamentos" ADD COLUMN "idade_meses" INTEGER;
ALTER TABLE "equipamentos" ADD CONSTRAINT "equipamento_valor_aquisicao_check"
  CHECK ("valor_aquisicao_centavos" IS NULL OR "valor_aquisicao_centavos" >= 0);
ALTER TABLE "equipamentos" ADD CONSTRAINT "equipamento_idade_meses_check"
  CHECK ("idade_meses" IS NULL OR "idade_meses" BETWEEN 0 AND 1200);
ALTER TABLE "equipamentos" ADD CONSTRAINT "equipamento_dados_financeiros_pareados_check"
  CHECK (("valor_aquisicao_centavos" IS NULL) = ("idade_meses" IS NULL));

CREATE TABLE "parametros_financeiros" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "aliquota_imposto_bps" INTEGER NOT NULL DEFAULT 0,
    "coeficiente_depreciacao_anual_bps" INTEGER NOT NULL DEFAULT 2000,
    "versao" INTEGER NOT NULL DEFAULT 1,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "parametros_financeiros_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "parametros_financeiros_singleton_check" CHECK ("id" = 1),
    CONSTRAINT "parametros_financeiros_aliquota_check" CHECK ("aliquota_imposto_bps" BETWEEN 0 AND 10000),
    CONSTRAINT "parametros_financeiros_depreciacao_check" CHECK ("coeficiente_depreciacao_anual_bps" BETWEEN 0 AND 10000)
);
