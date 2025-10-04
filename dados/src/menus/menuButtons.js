export default async function menuButtons(prefix, botName = "MeuBot", userName = "Usuário", {
    header = `╭┈⊰ 🌸 『 *${botName}* 』\n┊Olá, #user#!\n╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯`,
    menuTopBorder = "╭┈",
    bottomBorder = "╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯",
    menuTitleIcon = "🍧ฺꕸ▸",
    menuItemIcon = "•.̇𖥨֗🍓⭟",
    separatorIcon = "❁",
    middleBorder = "┊"
} = {}) {
    const formattedHeader = header.replace(/#user#/g, userName);
    
    return {
        text: formattedHeader + '\n\n🔘 *Selecione uma categoria abaixo:*',
        title: `🌸 ${botName}`,
        subtitle: `Olá, ${userName}!`,
        footer: 'Escolha uma opção para ver os comandos',
        interactiveButtons: [
            {
                name: 'single_select',
                buttonParamsJson: JSON.stringify({
                    title: '📋 Selecionar Menu',
                    sections: [
                        {
                            title: '🤖 Inteligência Artificial',
                            highlight_label: 'IA',
                            rows: [
                                {
                                    header: '🤖 Menu IA',
                                    title: 'Comandos de IA',
                                    description: 'ChatGPT, Gemini e outras IAs',
                                    id: `${prefix}menuia`
                                }
                            ]
                        },
                        {
                            title: '📥 Downloads',
                            highlight_label: 'Downloads',
                            rows: [
                                {
                                    header: '📥 Menu Downloads',
                                    title: 'Baixar Conteúdo',
                                    description: 'YouTube, TikTok, Instagram e mais',
                                    id: `${prefix}menudown`
                                }
                            ]
                        },
                        {
                            title: '👑 Administração',
                            highlight_label: 'Admin',
                            rows: [
                                {
                                    header: '👑 Menu Admin',
                                    title: 'Comandos de Admin',
                                    description: 'Gerenciar grupo e usuários',
                                    id: `${prefix}menuadm`
                                }
                            ]
                        },
                        {
                            title: '🎲 Diversão',
                            highlight_label: 'Jogos',
                            rows: [
                                {
                                    header: '� Menu Brincadeiras & Jogos',
                                    title: '🎯 Diversão Total',
                                    description: '🎲 Jogos, rankings, ships e muita zoeira!',
                                    id: `${prefix}menubn`
                                }
                            ]
                        },
                        {
                            title: '🛠️ Ferramentas',
                            highlight_label: 'Tools',
                            rows: [
                                {
                                    header: '🛠️ Ferramentas',
                                    title: 'Utilitários',
                                    description: 'Ferramentas úteis e conversores',
                                    id: `${prefix}ferramentas`
                                }
                            ]
                        },
                        {
                            title: '👥 Membros',
                            highlight_label: 'Membros',
                            rows: [
                                {
                                    header: '👥 Menu Membros',
                                    title: 'Comandos Gerais',
                                    description: 'Comandos para todos os usuários',
                                    id: `${prefix}menumemb`
                                }
                            ]
                        },
                        {
                            title: '🎨 Criação',
                            highlight_label: 'Criar',
                            rows: [
                                {
                                    header: '🎨 Menu Stickers',
                                    title: 'Criar Figurinhas',
                                    description: 'Comandos para criar stickers',
                                    id: `${prefix}menufig`
                                },
                                {
                                    header: '✨ Alteradores',
                                    title: 'Efeitos de Texto',
                                    description: 'Modificar textos e imagens',
                                    id: `${prefix}alteradores`
                                }
                            ]
                        },
                        {
                            title: '💰 Economia',
                            highlight_label: 'Gold',
                            rows: [
                                {
                                    header: '💰 Menu Gold',
                                    title: 'Sistema de Economia',
                                    description: 'Ganhar e gastar gold no jogo',
                                    id: `${prefix}menugold`
                                }
                            ]
                        },
                        {
                            title: '👑 Dono',
                            highlight_label: 'Owner',
                            rows: [
                                {
                                    header: '👑 Menu Dono',
                                    title: 'Comandos do Dono',
                                    description: 'Apenas para o criador do bot',
                                    id: `${prefix}menudono`
                                }
                            ]
                        }
                    ]
                })
            }
        ]
    };
}