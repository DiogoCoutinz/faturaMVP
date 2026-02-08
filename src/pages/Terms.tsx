export default function Terms() {
  return (
    <div className="min-h-screen bg-background py-16 px-4">
      <div className="max-w-2xl mx-auto space-y-8">
        <h1 className="text-3xl font-bold">Termos de Servico</h1>
        <p className="text-sm text-muted-foreground">Ultima atualizacao: Janeiro 2025</p>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">1. Descricao do Servico</h2>
          <p className="text-muted-foreground">
            O FaturaAI e uma plataforma de gestao automatizada de faturas que utiliza inteligencia artificial para extrair, organizar e arquivar documentos fiscais. O servico integra-se com o Google Drive, Google Sheets e Gmail do utilizador.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">2. Conta e Acesso</h2>
          <p className="text-muted-foreground">
            O acesso ao servico requer autenticacao via conta Google. O utilizador e responsavel por manter a seguranca da sua conta e por todas as atividades realizadas com as suas credenciais.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">3. Utilizacao Aceitavel</h2>
          <p className="text-muted-foreground">
            O servico destina-se exclusivamente a gestao de faturas e documentos fiscais legitimos. O utilizador compromete-se a nao utilizar o servico para fins ilegais ou nao autorizados.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">4. Dados e Propriedade</h2>
          <p className="text-muted-foreground">
            O utilizador mantem total propriedade sobre os seus dados e documentos. O FaturaAI nao reivindica qualquer direito sobre o conteudo submetido. Os ficheiros permanecem no Google Drive do utilizador.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">5. Limitacao de Responsabilidade</h2>
          <p className="text-muted-foreground">
            O servico e fornecido "tal como esta". A analise por IA pode conter imprecisoes - o utilizador deve sempre verificar os dados extraidos. O FaturaAI nao se responsabiliza por erros na categorizacao automatica ou extracao de dados.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">6. Cancelamento</h2>
          <p className="text-muted-foreground">
            O utilizador pode cancelar a sua conta a qualquer momento. Apos cancelamento, os dados serao eliminados dos nossos servidores. Os ficheiros no Google Drive do utilizador nao serao afetados.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">7. Contacto</h2>
          <p className="text-muted-foreground">
            Para questoes sobre estes termos, contacte: flowzi.pt@gmail.com
          </p>
        </section>
      </div>
    </div>
  );
}
