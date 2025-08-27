export const QUERIES = [
  '("como economizar com tecnologia" OR "reduzir custos com tecnologia") AND ("escalar meu negócio" OR "escalar meu negocio") AND ("com segurança" OR "sem risco" OR "segurança de dados")',
  '("minha empresa" OR "meu negócio" OR "meu negocio" OR "minha startup") AND (economizar OR "reduzir custos" OR "otimizar custos" OR FinOps) AND (TI OR tecnologia OR cloud OR nuvem) NOT vaga',
  '("conta da nuvem" OR "fatura AWS" OR "custo de nuvem" OR "gasto cloud") AND ("fora do controle" OR caro OR "explodiu" OR "surpresa")',
  '("custo por cliente" OR "custo por transação" OR "custo por transacao") AND (alto OR inviável OR inviavel OR "não fecha a conta" OR "nao fecha a conta")',
  '("escalar" OR escalabilidade OR "pico de tráfego" OR "pico de trafego") AND ("sem gastar" OR "baixo custo" OR "custo eficiente")',
  '("produto lento" OR "site lento" OR "app lento") AND ("perdendo venda" OR "perdendo clientes" OR churn OR "queda de conversão" OR "queda de conversao")',
  '("monolito" OR legado OR "dívida técnica" OR "divida tecnica") AND (refatorar OR migrar OR "microserviços" OR microservicos) AND ("sem downtime" OR "sem parar produção" OR "sem parar producao" OR "com segurança")',
  '(LGPD OR compliance OR "segurança" OR seguranca) AND ("não sei por onde começar" OR "nao sei por onde comecar" OR risco OR vazamento OR incidente)',
  '("backup" OR "disaster recovery" OR "contingência" OR contingencia) AND (teste OR falhou OR inexistente)',
  '("observabilidade" OR "sem logs" OR "sem métricas" OR "sem metricas") AND (prod OR produção OR producao)',
  '("rate limit" OR "erro 500" OR timeout OR latência OR latencia) AND (checkout OR vendas OR clientes) AND ("como resolver" OR "preciso ajuda")',
  '("minha empresa precisa" OR "meu negócio precisa" OR "meu negocio precisa") AND (automatizar OR escalar OR "reduzir custos" OR "organizar TI" OR "arrumar TI" OR arquitetura)',
  '("time técnico" OR "time de tecnologia" OR "equipe dev" OR "tech lead") AND (caro OR lento OR "alta rotatividade" OR turnover OR "não consigo contratar" OR "nao consigo contratar")',
  '("terceirizei" OR terceirizacao OR outsourcing) AND ("deu errado" OR "sem qualidade" OR "não entregou" OR "nao entregou" OR "sumiu")',
  '("sou dono" OR "sou CEO" OR "sou fundador" OR "sou sócio" OR "sou socio") AND ("minha empresa" OR "meu negócio" OR "meu negocio") AND (precisa OR precisamos) AND (escalar OR "reduzir custos" OR "segurança" OR "seguranca")',
  'title:("não escala" OR "nao escala" OR "reduzir custos" OR "segurança") AND (self:true OR self:false)',
  'selftext:(economizar OR "reduzir custos" OR FinOps) AND (cloud OR nuvem OR AWS OR Azure OR GCP)',
  'subreddit:(brasil OR brdev OR empreendedor OR empreendedorismo OR startups OR saas) AND ("não escala" OR "nao escala" OR "conta da nuvem" OR LGPD)'
];
export default QUERIES;
