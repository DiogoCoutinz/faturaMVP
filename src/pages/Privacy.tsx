export default function Privacy() {
  return (
    <div className="min-h-screen bg-background py-16 px-4">
      <div className="max-w-2xl mx-auto space-y-8">
        <h1 className="text-3xl font-bold">Politica de Privacidade</h1>
        <p className="text-sm text-muted-foreground">Ultima atualizacao: Janeiro 2025</p>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">1. Dados Recolhidos</h2>
          <p className="text-muted-foreground">
            Recolhemos apenas os dados necessarios para o funcionamento do servico: nome, email e dados de faturas que o utilizador submete voluntariamente. Acedemos ao Google Drive e Gmail apenas com autorizacao explicita para gerir os ficheiros de faturas do utilizador.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">2. Utilizacao dos Dados</h2>
          <p className="text-muted-foreground">
            Os dados sao utilizados exclusivamente para: processar e organizar faturas, gerar relatorios de despesas, e sincronizar com o Google Drive do utilizador. Nao vendemos nem partilhamos dados com terceiros.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">3. Google API</h2>
          <p className="text-muted-foreground">
            A utilizacao de informacao recebida das APIs do Google esta em conformidade com a Google API Services User Data Policy, incluindo os requisitos de Limited Use. Apenas acedemos aos escopos estritamente necessarios (Drive, Sheets, Gmail) e os dados nunca sao transferidos para terceiros.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">4. Armazenamento e Seguranca</h2>
          <p className="text-muted-foreground">
            Os dados sao armazenados de forma segura com encriptacao em transito e em repouso. Utilizamos Supabase como base de dados com Row Level Security ativado, garantindo que cada utilizador so acede aos seus proprios dados.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">5. Direitos do Utilizador</h2>
          <p className="text-muted-foreground">
            O utilizador pode a qualquer momento: aceder aos seus dados, solicitar a sua correcao ou eliminacao, e revogar o acesso ao Google. Para exercer estes direitos, contacte-nos atraves do email indicado na aplicacao.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">6. Contacto</h2>
          <p className="text-muted-foreground">
            Para questoes relacionadas com privacidade, contacte: __PLACEHOLDER_CONTACT_EMAIL__
          </p>
        </section>
      </div>
    </div>
  );
}
