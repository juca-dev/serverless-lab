// Plug-and-play: entrepreneur-pain queries for Reddit search (PT-BR, founders/C-level voice)
export const QUERIES = [
  // === Voz do empresário: necessidades explícitas ===
  '("minha empresa precisa" OR "meu negócio precisa" OR "meu negocio precisa" OR "minha startup precisa") (escalar OR "reduzir custos" OR automatizar OR "organizar TI" OR "arrumar TI" OR arquitetura)',
  '("minha empresa precisa" OR "meu negócio precisa" OR "meu negocio precisa") ("time técnico" OR "time de tecnologia" OR "equipe dev" OR "tech lead" OR CTO OR "gestão de TI" OR "gestao de TI")',
  '("sou dono" OR "sou CEO" OR "sou fundador" OR "sou sócio" OR "sou socio") ("não entendo de tecnologia" OR "nao entendo de tecnologia" OR "não sei por onde começar" OR "nao sei por onde comecar" OR "como contratar dev")',
  '("como dono" OR "como CEO" OR "como fundador") ("não consigo escalar" OR "nao consigo escalar" OR "produto não escala" OR "produto nao escala")',
  '("minha empresa" OR "meu negócio" OR "meu negocio" OR "minha startup") ("perdendo clientes" OR "perdendo venda" OR churn OR "queda de conversão" OR "queda de conversao" OR checkout)',
  '("minha empresa" OR "meu negócio" OR "meu negocio") ("infra cara" OR "custo de nuvem" OR "fatura AWS" OR "gasto na cloud" OR "conta da nuvem")',

  // === Time técnico / Pessoas / Terceirização ===
  '("time técnico" OR "time de tecnologia" OR "equipe dev" OR squad) (pequeno OR sobrecarregado OR júnior OR junior OR "alta rotatividade" OR turnover OR caro OR lento)',
  '("difícil contratar dev" OR "dificil contratar dev" OR "contratar sênior" OR "contratar senior") (salário OR custo OR remoto OR prazo)',
  '("terceirizei" OR terceirizacao OR outsourcing) ("deu errado" OR "me arrependi" OR sumiu OR "sem qualidade" OR "não entregou" OR "nao entregou")',
  '("faltam processos" OR "sem processo" OR "sem gestão" OR "sem gestao") (deploy OR backlog OR prioridade OR roadmap OR sprint)',
  '("sem CTO" OR "não tenho CTO" OR "nao tenho CTO") ("preciso de tech lead" OR "gestão tecnológica" OR "gestao tecnologica" OR "liderança técnica" OR "lideranca tecnica")',

  // === Legado / Código / Arquitetura ===
  '("legado" OR "código espaguete" OR "codigo espaguete" OR "dívida técnica" OR "divida tecnica") ("medo de refatorar" OR "refatorar assusta" OR "vai quebrar produção" OR "vai quebrar producao")',
  '(monolito) (migrar OR "microserviços" OR microservicos OR modularizar)',
  '("banco de dados" OR Postgres OR PostgreSQL OR Mongo OR DynamoDB) (gargalo OR "lentidão" OR lentidao OR travando OR deadlock)',
  '(cache OR CDN) ("não resolve" OR "nao resolve" OR "não ajudou" OR "nao ajudou")',

  // === Confiabilidade / Observabilidade / Produção ===
  '("produção caiu" OR "producao caiu" OR "saiu do ar" OR "fora do ar") ("sem logs" OR "sem métricas" OR "sem metricas" OR "sem observabilidade" OR "sem monitoria")',
  '("erro 500" OR timeout OR "latência" OR latencia) ("perdendo cliente" OR "perdendo venda" OR checkout)',
  '("MTTR" OR SLA OR SLO) (estourado OR "não batemos" OR "nao batemos" OR "acima do acordado")',
  '("deploy manual" OR "sem CI/CD" OR "sem pipeline") (risco OR "bug em produção" OR "bug em producao" OR rollback)',

  // === Custos / FinOps ===
  '("fatura" OR "conta" OR custo) (AWS OR Azure OR GCP OR cloud OR nuvem) (caro OR "explodiu" OR "susto" OR "surpresa" OR "fora do controle")',
  '("otimizar custos" OR "reduzir custos" OR FinOps) (nuvem OR cloud OR infraestrutura OR servidor)',
  '("custo por cliente" OR "custo por transação" OR "custo por transacao") (alto OR inviável OR inviavel OR "não fecha a conta" OR "nao fecha a conta")',

  // === Performance / Crescimento ===
  '("site lento" OR "produto lento" OR "app lento") ("perdendo conversão" OR "perdendo conversao" OR "queda na conversão" OR "queda na conversao")',
  '("pico de tráfego" OR "pico de trafego") (caiu OR travou OR "não escala" OR "nao escala" OR "não aguentou" OR "nao aguentou")',

  // === Segurança / Conformidade ===
  '("LGPD" OR "segurança" OR seguranca) ("não sei por onde começar" OR "nao sei por onde comecar" OR risco OR vazamento OR compliance)',

  // === Documentação / Roadmap / Visibilidade ===
  '("sem documentação" OR "sem documentacao") (onboarding OR "entrada de dev" OR "nova equipe" OR "novo time")',
  '("roadmap técnico" OR "roadmap tecnico" OR "priorizar tecnologia") ("não consigo" OR "nao consigo" OR difícil OR dificil OR "sem clareza")',
  '("falta de visibilidade" OR "sem visibilidade") (sistema OR operação OR operacao OR produto)',

  // === Bloqueios emocionais / Delegação / Confiança ===
  '("medo de investir" OR "medo de gastar") (tecnologia OR TI OR "refatoração" OR refatoracao OR arquitetura)',
  '("não confio na equipe" OR "nao confio na equipe" OR "não consigo delegar" OR "nao consigo delegar") (tecnologia OR TI OR produto)',
  '("não tenho tempo" OR "nao tenho tempo") ("cuidar da TI" OR tecnologia OR produto OR "gestão tecnológica" OR "gestao tecnologica")',

  // === Identificação de decisor no texto ===
  '("sou dono" OR "sou sócio" OR "sou socio" OR "sou CEO" OR "sou fundador") (empresa OR "meu negócio" OR "meu negocio") (precisa OR precisamos OR estamos)',
  '("como empresário" OR "como empresario") ("minha empresa" OR "meu negócio" OR "meu negocio") (TI OR tecnologia OR software)',

  // === Integrações / Automação / Dependência de planilhas ===
  '("dependo de planilhas" OR "preso em planilhas" OR "muita planilha") ("queria automatizar" OR "automatizar processos" OR "tirar das planilhas")',
  '("queria integrar" OR "preciso integrar") (ERP OR CRM OR "gateway de pagamento" OR "meio de pagamento" OR API)',
];

export default QUERIES;
