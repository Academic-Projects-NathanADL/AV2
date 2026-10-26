# GreenCode — Circuito Vivo

**Passaportes circulares para eletrônicos corporativos.** O Circuito Vivo conecta a origem de um equipamento ao seu destino e mantém uma trilha de custódia que pode ser consultada pela operação ou por auditoria. Cada item recebe um código de rastreio próprio; lotes e movimentações compõem seu “passaporte circular”.

Esta é a evolução da AV1: sai o CLI com arquivos cifrados e entra uma API REST monolítica, com Fastify, TypeScript, Prisma ORM e PostgreSQL.

As escolhas e os trade-offs estão registrados em [`docs/decisoes-arquiteturais.md`](docs/decisoes-arquiteturais.md).

## O toque próprio do produto

- **Passaporte circular:** a consulta de um equipamento reúne organização geradora, lote, condição física, situação atual, destino final e quem registrou cada etapa.
- **Painel Circuito Vivo:** apresenta a fila operacional e o índice de destino circular. O índice é uma métrica interna simples — reutilizados + reciclados sobre o total cadastrado — e não uma estimativa de CO₂ ou de impacto ambiental certificado.
- **Histórias de demonstração:** Aurora Financeira, Hospital Horizonte Vivo e Instituto Aberto de Tecnologia representam fluxos diferentes de geração e destinação, tornando a apresentação menos genérica.
- **Identidade visual/API:** códigos `CV-*`, descrições de rotas orientadas à cadeia de custódia e documentação Swagger em `/docs`.

## Tecnologias e requisitos

- Node.js 20.19+ (desenvolvimento local recomendado: Node 24)
- Fastify 5, TypeScript, Prisma ORM 6.19 e PostgreSQL 16
- JWT com `@fastify/jwt`; hashes de senha com bcryptjs
- JSON Schema/TypeBox para validar e documentar os contratos HTTP
- Docker Desktop com Compose ou PostgreSQL instalado localmente

## Rodar localmente

Requisitos: Node.js 20.19 ou superior, npm e Docker Desktop com o mecanismo do Docker em execução. No PowerShell, crie o arquivo local de ambiente:

```powershell
Copy-Item .env.example .env
```

No Linux/macOS, use `cp .env.example .env`. O `.env.example` usa a mesma URL, usuário, senha e banco configurados no `docker-compose.yml`; ajuste `DATABASE_URL` se usar outro PostgreSQL.

```bash
npm install
npm run db:up
docker compose ps                 # aguarde o estado healthy do serviço db
npm run db:deploy                 # aplica a migration que já está no projeto
npm run db:seed
npm run dev
```

Se o banco ainda estiver iniciando, espere alguns segundos e confira `docker compose ps` novamente antes de aplicar a migration. Para ver o diagnóstico do contêiner, use `docker compose logs db`.

O servidor escuta em `http://localhost:3333`. A especificação e a interface interativa ficam em `http://localhost:3333/docs`; `GET /health` verifica o banco e a aplicação.

Para compilar e executar a versão gerada:

```bash
npm run build
npm start
```

Para desenvolvimento, `JWT_SECRET` deve ter pelo menos 32 caracteres. O segredo de exemplo é somente local; substitua-o fora desse ambiente. `HOST`, `PORT`, `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `CORS_ORIGIN` e `LOG_LEVEL` são configuráveis por ambiente.

### Contas de demonstração

O seed cria estas contas para apresentação local:

| Perfil | Login | Senha |
|---|---|---|
| Administrador | `admin@greencode.local` | `CircuitoVivo!2026` |
| Operador de cadastro | `operador@greencode.local` | `Operador!2026` |
| Gestor de almoxarifado | `gestor@greencode.local` | `Gestor!2026` |
| Auditor | `auditor@greencode.local` | `Auditor!2026` |

Essas credenciais são apenas dados de demonstração e não devem ser usadas em implantação real.

## Fluxo rápido da API

1. `POST /api/v1/auth/login` com `{ "login": "admin@greencode.local", "senha": "CircuitoVivo!2026" }`.
2. Envie o token retornado em `Authorization: Bearer <token>`.
3. Cadastre uma organização em `POST /api/v1/organizations` e associe seu contrato em `POST /api/v1/organizations/:id/contracts`.
4. Receba o lote com pelo menos um equipamento em `POST /api/v1/lots`; essa operação cria lote, equipamentos e movimentos de entrada numa transação.
5. Atualize a condição ou etapa em `PATCH /api/v1/equipment/:id/condition` e `PATCH /api/v1/equipment/:id/status`. Informe `versaoEsperada` para evitar sobrescrever uma alteração concorrente.
6. Consulte o passaporte em `GET /api/v1/equipment/:id/trace` e o painel em `GET /api/v1/reports/circularity`.
7. Para uma estimativa financeira, cadastre `valorAquisicaoCentavos` e `idadeMeses` no item do lote e consulte `GET /api/v1/equipment/:id/valuation`.

### Estimativa financeira

O administrador consulta `GET /api/v1/settings/financial` e atualiza os parâmetros em `PUT /api/v1/settings/financial`, enviando a versão lida:

```json
{
  "versaoEsperada": 1,
  "aliquotaImpostoBps": 600,
  "coeficienteDepreciacaoAnualBps": 2000
}
```

Os valores usam pontos-base (100 bps = 1%). O seed inicia com imposto em 0% e depreciação linear anual em 20%; o administrador deve ajustar os parâmetros à regra definida para a demonstração. No cadastro de cada equipamento, `valorAquisicaoCentavos` é informado em centavos e `idadeMeses` em meses; os dois campos são opcionais, mas precisam ser enviados juntos. A estimativa calcula o valor contábil após depreciação linear, o imposto sobre esse valor e o líquido estimado. O resultado é uma simulação operacional, não aconselhamento tributário ou avaliação contábil.

### Teste ponta a ponta no PowerShell

Com o servidor iniciado em um terminal, abra outro PowerShell na pasta `AV2`. O roteiro abaixo verifica conexão, login, permissões, estimativa financeira, recebimento de lote, triagem, rastreabilidade, validação de código de barras e conflito de versão. Ele cria um lote de demonstração adicional.

```powershell
$base = "http://localhost:3333"

# Saúde da API e do banco: deve mostrar status ok e banco conectado.
Invoke-RestMethod "$base/health"

# Login administrativo e token para as rotas protegidas.
$loginBody = @{ login = "admin@greencode.local"; senha = "CircuitoVivo!2026" } | ConvertTo-Json
$login = Invoke-RestMethod -Method Post -Uri "$base/api/v1/auth/login" -ContentType "application/json" -Body $loginBody
$headers = @{ Authorization = "Bearer $($login.accessToken)" }

# O administrador ajusta os parâmetros; 600 bps = 6% e 2000 bps = 20% ao ano.
$config = Invoke-RestMethod "$base/api/v1/settings/financial" -Headers $headers
$configBody = @{ versaoEsperada = $config.versao; aliquotaImpostoBps = 600; coeficienteDepreciacaoAnualBps = 2000 } | ConvertTo-Json
Invoke-RestMethod -Method Put -Uri "$base/api/v1/settings/financial" -Headers $headers -ContentType "application/json" -Body $configBody

# Criar lote com equipamento de R$ 2.500,00 e 24 meses de idade.
$organizacoes = Invoke-RestMethod "$base/api/v1/organizations" -Headers $headers
$loteBody = @{
  organizacaoId = $organizacoes[0].id
  notaFiscal = "NF-TESTE-README"
  transportadora = "Transportadora de teste"
  dataEntrada = (Get-Date).ToString("yyyy-MM-dd")
  equipamentos = @(@{ tipo = "NOTEBOOK"; estadoFisico = "BOM"; valorAquisicaoCentavos = 250000; idadeMeses = 24 })
} | ConvertTo-Json -Depth 10
$lote = Invoke-RestMethod -Method Post -Uri "$base/api/v1/lots" -Headers $headers -ContentType "application/json" -Body $loteBody
$equipamento = $lote.equipamentos[0]

# Esperado: valor contabil 150000, imposto 9000 e valor liquido 141000 (centavos).
Invoke-RestMethod "$base/api/v1/equipment/$($equipamento.id)/valuation" -Headers $headers

# O auditor pode ler o painel, mas nao pode alterar parametros (esperado: HTTP 403).
$auditorBody = @{ login = "auditor@greencode.local"; senha = "Auditor!2026" } | ConvertTo-Json
$auditorLogin = Invoke-RestMethod -Method Post -Uri "$base/api/v1/auth/login" -ContentType "application/json" -Body $auditorBody
$auditorHeaders = @{ Authorization = "Bearer $($auditorLogin.accessToken)" }
Invoke-RestMethod "$base/api/v1/reports/circularity" -Headers $auditorHeaders
$bloqueioBody = @{ versaoEsperada = 1; aliquotaImpostoBps = 600; coeficienteDepreciacaoAnualBps = 2000 } | ConvertTo-Json
try {
  Invoke-RestMethod -Method Put -Uri "$base/api/v1/settings/financial" -Headers $auditorHeaders -ContentType "application/json" -Body $bloqueioBody
  Write-Host "FALHA: o auditor conseguiu alterar os parametros."
} catch {
  Write-Host "HTTP esperado 403; recebido $([int]$_.Exception.Response.StatusCode)."
}

# Triar sem codigo de barras deve retornar HTTP 400 e nao alterar o equipamento.
$equipamentos = Invoke-RestMethod "$base/api/v1/equipment" -Headers $headers
$pendente = @($equipamentos | Where-Object status -eq "AGUARDANDO_TRIAGEM" | Select-Object -First 1)[0]
$semCodigoBody = @{ versaoEsperada = $pendente.versao; novoStatus = "TRIADO" } | ConvertTo-Json
try {
  Invoke-RestMethod -Method Patch -Uri "$base/api/v1/equipment/$($pendente.id)/status" -Headers $headers -ContentType "application/json" -Body $semCodigoBody
  Write-Host "FALHA: a triagem sem codigo foi aceita."
} catch {
  Write-Host "HTTP esperado 400; recebido $([int]$_.Exception.Response.StatusCode)."
}
(Invoke-RestMethod "$base/api/v1/equipment/$($pendente.id)/trace" -Headers $headers).situacao

# Triagem valida e consulta da trilha de custodia.
$codigoBarras = "BC-README-$(Get-Random -Minimum 100000 -Maximum 999999)"
$triagemBody = @{ versaoEsperada = $equipamento.versao; novoStatus = "TRIADO"; codigoBarras = $codigoBarras } | ConvertTo-Json
$triado = Invoke-RestMethod -Method Patch -Uri "$base/api/v1/equipment/$($equipamento.id)/status" -Headers $headers -ContentType "application/json" -Body $triagemBody
Invoke-RestMethod "$base/api/v1/equipment/$($equipamento.id)/trace" -Headers $headers

# A mesma alteracao com versao antiga deve retornar HTTP 409 e manter status TRIADO.
$conflitoBody = @{ versaoEsperada = $triado.versao - 1; novoStatus = "RECICLADO"; destinoFinal = "Teste de concorrencia" } | ConvertTo-Json
try {
  Invoke-RestMethod -Method Patch -Uri "$base/api/v1/equipment/$($equipamento.id)/status" -Headers $headers -ContentType "application/json" -Body $conflitoBody
  Write-Host "FALHA: a versao antiga foi aceita."
} catch {
  Write-Host "HTTP esperado 409; recebido $([int]$_.Exception.Response.StatusCode)."
}
(Invoke-RestMethod "$base/api/v1/equipment/$($equipamento.id)/trace" -Headers $headers).situacao
```

Nos erros esperados, confira o número HTTP impresso pelo `catch`. No último estado, o item deve permanecer `TRIADO` com a mesma versão devolvida pela triagem válida. Se o PowerShell indicar erro de `Content-Length`, mantenha textos ASCII nos corpos JSON de teste (sem acentos). O mesmo fluxo também pode ser feito manualmente pela interface Swagger em `/docs`.

Exemplo de transição de triagem:

```json
{
  "versaoEsperada": 1,
  "novoStatus": "TRIADO",
  "codigoBarras": "BC-2026-00918"
}
```

O equipamento precisa completar a triagem antes de ser encaminhado para desmontagem. Para concluir o passaporte, informe um destino final em estados como `REUTILIZADO`, `RECICLADO` ou `DESCARTE_SEGURO`.

## Perfis e acesso

| Perfil | Pode fazer |
|---|---|
| Administrador | Contas, parâmetros de acesso e todas as operações |
| Operador de cadastro | Organizações e contratos; consulta operacional |
| Gestor de almoxarifado | Recebimento de lotes, triagem, condições e destinos |
| Auditor | Consultas de rastreabilidade e painel; sem alterações |

As rotas protegidas exigem JWT. A autorização é conferida no servidor; ocultar uma rota da interface de cliente não substitui essa verificação.

## Arquitetura

```text
HTTP + JSON Schema
        ↓
Routes / Controllers (Fastify)
        ↓
Services (validação e regras de negócio)
        ↓
Repositories (Prisma Client)
        ↓
PostgreSQL
```

- **Controllers/routes:** definem contratos HTTP, validação estrutural, autenticação e delegação.
- **Services:** aplicam CNPJ, janela de 90 dias, permissões e regras do ciclo circular.
- **Repositories:** concentram as consultas e escritas Prisma.
- **Prisma:** modelo relacional, chaves estrangeiras, índices, unicidade e migrations versionadas.

### Transações e concorrência

Receber um lote com seus equipamentos e movimentos usa uma transação Prisma. Mudar estado ou condição do equipamento grava a atualização e sua movimentação na mesma transação; se uma falhar, nenhuma é confirmada. Cada modelo tem `versao`. Nas atualizações concorrentes, o `UPDATE` exige o ID e a versão lida (`updateMany` com `versao` esperada) e incrementa a versão; conflito retorna HTTP 409 para o cliente recarregar antes de tentar novamente.

### Segurança

- Senhas são armazenadas com bcryptjs e fator de custo 12; nunca são incluídas nas respostas.
- JWT HS256 carrega somente identificador, login e perfil, com validade configurável (padrão: 30 minutos).
- Login tem limite de tentativas por IP; logs redigem cabeçalho Authorization e campo senha.
- Helmet aplica cabeçalhos HTTP de segurança; CORS é configurável.
- O segredo JWT precisa ser substituído por um valor aleatório fora de desenvolvimento.

## Dados e migrations

O seed é idempotente e cria quatro perfis, organizações de demonstração, contratos, lotes e equipamentos em etapas distintas do ciclo. Para evoluir o schema, edite `prisma/schema.prisma` e gere uma migration com `npm run db:migrate -- --name descricao-da-alteracao`. Em implantação, aplique migrations existentes com `npm run db:deploy`.

O seed demonstra a nova base relacional; a importação de dados reais dos arquivos da AV1 exigiria um exportador de cada `.enc` usando a chave mestra original. Como essa chave não deve ser copiada para o repositório, essa migração deve ser executada no ambiente que possui os dados e a chave.

## Estrutura

```text
prisma/schema.prisma      modelos, enums e relações
prisma/seed.ts            massa de demonstração idempotente
src/routes/               contratos HTTP e validação TypeBox
src/services/             regras de negócio
src/repositories/          acesso Prisma e transações
src/plugins/auth.ts       JWT e autorização por perfil
src/domain/               indicadores do Circuito Vivo
src/server.ts             Fastify, OpenAPI e graceful shutdown
```
