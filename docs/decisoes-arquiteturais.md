# Decisões arquiteturais — Circuito Vivo

## Contexto do produto

O desafio não é só guardar equipamentos usados. Empresas precisam demonstrar de onde veio cada item, quem o recebeu, o que a triagem encontrou e qual foi o destino final. O Circuito Vivo organiza essa cadeia em um **passaporte circular** consultável por código. O nome mantém GreenCode como plataforma e dá ao produto uma ideia visual memorável: cada movimentação é uma etapa do circuito.

## Monólito modular

Escolhemos um único processo HTTP, dividido em `routes → services → repositories`. Isso reduz a complexidade operacional da fase acadêmica e permite separar regras de negócio da comunicação HTTP. A camada de services não depende do formato do controller e poderá ser chamada por uma SPA sem duplicar as regras.

## Fastify e TypeScript

Fastify foi escolhido pelo suporte a plugins e validação/serialização por JSON Schema. TypeBox cria os schemas de runtime e os tipos TypeScript a partir da mesma definição, reduzindo a diferença entre o contrato documentado e o que a API aceita. Express também funcionaria; Fastify se encaixa melhor no requisito de schemas declarativos e no catálogo de plugins do projeto.

## PostgreSQL e Prisma

PostgreSQL mantém integridade relacional entre organizações, contratos, lotes, equipamentos e movimentações. Prisma oferece modelos tipados e migrations versionadas. CNPJ, login, número de contrato, código público de lote, código de rastreio e código de barras recebem unicidade no banco; índices cobrem consultas comuns de lotes por organização e trilhas por equipamento.

O modelo mantém um contrato opcional por organização, vários lotes por organização, vários equipamentos por lote e várias movimentações por equipamento. IDs UUID reduzem a exposição de sequências previsíveis na API.

## JWT e autorização

JWT foi escolhido porque a API REST deve aceitar chamadas independentes e suportar vários clientes. O token expira em 30 minutos por padrão e carrega somente ID, login e papel. Cada rota altera ou consulta recursos apenas após o hook de autenticação e a regra de papel apropriada. Senhas usam bcryptjs com fator 12, em vez do SHA-256 simples da primeira etapa, pois a AV2 abre espaço para um algoritmo próprio para armazenamento de senhas.

## Atomicidade e concorrência

Receber um lote cria o lote, os equipamentos e as movimentações iniciais em uma transação. Alterar situação ou condição de um equipamento grava também a movimentação correspondente na mesma transação.

Cada entidade tem uma coluna `versao`. As operações concorrentes atualizam por `id + versaoEsperada` e incrementam a versão. Se outra requisição ganhou a disputa, a atualização afeta zero linhas e a API retorna `409 Conflict`; o cliente deve buscar a versão atual e decidir novamente. Não usamos lock global, pois ele reduziria o paralelismo sem benefício para este fluxo.

## Regras em duas camadas

A API valida formato, CNPJ e regras de fluxo no service. A migration também instala constraints que protegem invariantes simples mesmo se uma gravação contornar a API: CNPJ com 14 dígitos, desmontagem após triagem, código de barras em itens triados e destino informado para status finais. A validação completa dos dígitos verificadores do CNPJ permanece na camada de domínio.

## Indicador de circularidade

O painel calcula `reutilizados + reciclados / total cadastrado`. Esse indicador é deliberadamente chamado **índice circular operacional**: demonstra distribuição dos destinos registrados sem inventar equivalência em toneladas de carbono, energia ou matéria-prima. Um cálculo ambiental certificado exigiria fatores por categoria, peso, origem e metodologia externa, dados que esta atividade não fornece.

## Estimativa financeira

Para transportar a configuração financeira prevista na AV1, o administrador configura uma alíquota de imposto e um coeficiente anual de depreciação em pontos-base. A cada equipamento é possível informar o valor de aquisição em centavos e sua idade em meses. O serviço calcula depreciação linear proporcional aos meses, aplica a alíquota ao valor contábil estimado e apresenta os valores bruto, depreciado, imposto previsto e líquido. Os campos do item são opcionais para não bloquear o recebimento de bens sem documentação de preço; quando usados, valor e idade são obrigatórios em conjunto. A configuração inicial (0% de imposto e 20% de depreciação anual) é apenas uma referência de demonstração, alterável pelo administrador. O resultado é uma simulação operacional e não substitui cálculo tributário ou contábil profissional.

## Seed em vez de dados pessoais

O seed cria cenários demonstrativos fictícios com perfis, organizações e passaportes em etapas diferentes. Dados reais da AV1 só devem ser importados no ambiente que possui o arquivo cifrado e sua chave; a chave não deve ser copiada para o repositório ou para a seed.

## Limites conhecidos

- O JWT é stateless; revogação imediata de um token antes da expiração exigiria uma lista de revogação ou sessões persistidas.
- `versao` protege gravações concorrentes, mas clientes precisam implementar recarga e reapresentação da mudança após `409`.
- O índice do painel é demonstrativo, não um relatório ambiental legal ou certificado.
- Para implantação, troque segredos e senhas de demonstração, limite `CORS_ORIGIN`, use HTTPS, configure backups do PostgreSQL e adicione monitoramento/retention conforme a operação.
