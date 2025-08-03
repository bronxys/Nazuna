async function menubn(
  prefix,
  botName = "MeuBot",
  userName = "Usuário",
  isLiteMode = false,
  {
    header = `╭┈⊰ 🌸 『 *${botName}* 』\n┊Olá, #user#!\n╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯`,
    menuTopBorder = "╭┈",
    bottomBorder = "╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯",
    menuTitleIcon = "🍧ฺꕸ▸",
    menuItemIcon = "•.̇𖥨֗🍓⭟",
    separatorIcon = "❁",
    middleBorder = "┊",
    gamesMenuTitle = "JOGOS",
    interactionsMenuTitle = "INTERAÇÕES",
    hotInteractionsMenuTitle = 'INTERAÇÕES "HOT"',
    maleFunMenuTitle = "BRINCADEIRAS - M",
    femaleFunMenuTitle = "BRINCADEIRAS - F",
    maleRanksMenuTitle = "RANKS - M",
    femaleRanksMenuTitle = "RANKS - F"
  } = {}
) {
  const formattedHeader = header.replace(/#user#/g, userName);

  let menuContent = `‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎‎
${formattedHeader}

${menuTopBorder}${separatorIcon} *${gamesMenuTitle}*
${middleBorder}
${middleBorder}${menuItemIcon}${prefix}jogodavelha
${middleBorder}${menuItemIcon}${prefix}eununca
${middleBorder}${menuItemIcon}${prefix}vab
${middleBorder}${menuItemIcon}${prefix}chance
${middleBorder}${menuItemIcon}${prefix}quando
${middleBorder}${menuItemIcon}${prefix}casal
${middleBorder}${menuItemIcon}${prefix}shipo
${middleBorder}${menuItemIcon}${prefix}sn
${middleBorder}${menuItemIcon}${prefix}ppt${isLiteMode ? '' : `\n${middleBorder}${menuItemIcon}${prefix}suicidio`}
${bottomBorder}

${menuTopBorder}${separatorIcon} *${interactionsMenuTitle}*
${middleBorder}
${middleBorder}${menuItemIcon}${prefix}chute
${middleBorder}${menuItemIcon}${prefix}chutar
${middleBorder}${menuItemIcon}${prefix}tapa
${middleBorder}${menuItemIcon}${prefix}soco
${middleBorder}${menuItemIcon}${prefix}socar
${middleBorder}${menuItemIcon}${prefix}explodir
${middleBorder}${menuItemIcon}${prefix}abraco
${middleBorder}${menuItemIcon}${prefix}abracar
${middleBorder}${menuItemIcon}${prefix}morder
${middleBorder}${menuItemIcon}${prefix}mordida
${middleBorder}${menuItemIcon}${prefix}lamber
${middleBorder}${menuItemIcon}${prefix}lambida
${middleBorder}${menuItemIcon}${prefix}beijo
${middleBorder}${menuItemIcon}${prefix}beijar
${middleBorder}${menuItemIcon}${prefix}mata
${middleBorder}${menuItemIcon}${prefix}matar
${middleBorder}${menuItemIcon}${prefix}cafune
${bottomBorder}
`;

  if (!isLiteMode) {
    menuContent += `
${menuTopBorder}${separatorIcon} *${hotInteractionsMenuTitle}*
${middleBorder}
${middleBorder}${menuItemIcon}${prefix}surubao
${middleBorder}${menuItemIcon}${prefix}sexo
${middleBorder}${menuItemIcon}${prefix}beijob
${middleBorder}${menuItemIcon}${prefix}beijarb
${middleBorder}${menuItemIcon}${prefix}tapar
${middleBorder}${menuItemIcon}${prefix}goza
${middleBorder}${menuItemIcon}${prefix}gozar
${middleBorder}${menuItemIcon}${prefix}mamar
${middleBorder}${menuItemIcon}${prefix}mamada
${bottomBorder}
`;
  }

  menuContent += `
${menuTopBorder}${separatorIcon} *${maleFunMenuTitle}*
${middleBorder}
${isLiteMode ? '' : `${middleBorder}${menuItemIcon}${prefix}gay\n`}${middleBorder}${menuItemIcon}${prefix}burro
${middleBorder}${menuItemIcon}${prefix}inteligente
${middleBorder}${menuItemIcon}${prefix}otaku
${middleBorder}${menuItemIcon}${prefix}fiel
${middleBorder}${menuItemIcon}${prefix}infiel${isLiteMode ? '' : `\n${middleBorder}${menuItemIcon}${prefix}corno`}
${middleBorder}${menuItemIcon}${prefix}gado
${middleBorder}${menuItemIcon}${prefix}gostoso
${middleBorder}${menuItemIcon}${prefix}feio
${middleBorder}${menuItemIcon}${prefix}rico
${middleBorder}${menuItemIcon}${prefix}pobre${isLiteMode ? '' : `\n${middleBorder}${menuItemIcon}${prefix}pirocudo${isLiteMode ? '' : `\n${middleBorder}${menuItemIcon}${prefix}nazista`}${isLiteMode ? '' : `\n${middleBorder}${menuItemIcon}${prefix}ladrao`}`}
${middleBorder}${menuItemIcon}${prefix}safado
${middleBorder}${menuItemIcon}${prefix}vesgo
${middleBorder}${menuItemIcon}${prefix}bebado${isLiteMode ? '' : `\n${middleBorder}${menuItemIcon}${prefix}machista${isLiteMode ? '' : `\n${middleBorder}${menuItemIcon}${prefix}homofobico${isLiteMode ? '' : `\n${middleBorder}${menuItemIcon}${prefix}racista`}`}`}
${middleBorder}${menuItemIcon}${prefix}chato
${middleBorder}${menuItemIcon}${prefix}sortudo
${middleBorder}${menuItemIcon}${prefix}azarado
${middleBorder}${menuItemIcon}${prefix}forte
${middleBorder}${menuItemIcon}${prefix}fraco
${middleBorder}${menuItemIcon}${prefix}pegador
${middleBorder}${menuItemIcon}${prefix}otario
${middleBorder}${menuItemIcon}${prefix}macho
${middleBorder}${menuItemIcon}${prefix}bobo
${middleBorder}${menuItemIcon}${prefix}nerd
${middleBorder}${menuItemIcon}${prefix}preguicoso
${middleBorder}${menuItemIcon}${prefix}trabalhador
${middleBorder}${menuItemIcon}${prefix}brabo
${middleBorder}${menuItemIcon}${prefix}lindo
${middleBorder}${menuItemIcon}${prefix}malandro
${middleBorder}${menuItemIcon}${prefix}simpatico
${middleBorder}${menuItemIcon}${prefix}engracado
${middleBorder}${menuItemIcon}${prefix}charmoso
${middleBorder}${menuItemIcon}${prefix}misterioso
${middleBorder}${menuItemIcon}${prefix}carinhoso
${middleBorder}${menuItemIcon}${prefix}desumilde
${middleBorder}${menuItemIcon}${prefix}humilde
${middleBorder}${menuItemIcon}${prefix}ciumento
${middleBorder}${menuItemIcon}${prefix}corajoso
${middleBorder}${menuItemIcon}${prefix}covarde
${middleBorder}${menuItemIcon}${prefix}esperto${isLiteMode ? '' : `\n${middleBorder}${menuItemIcon}${prefix}talarico`}
${middleBorder}${menuItemIcon}${prefix}chorao
${middleBorder}${menuItemIcon}${prefix}brincalhao${isLiteMode ? '' : `\n${middleBorder}${menuItemIcon}${prefix}bolsonarista${isLiteMode ? '' : `\n${middleBorder}${menuItemIcon}${prefix}petista${isLiteMode ? '' : `\n${middleBorder}${menuItemIcon}${prefix}comunista${isLiteMode ? '' : `\n${middleBorder}${menuItemIcon}${prefix}lulista${isLiteMode ? '' : `\n${middleBorder}${menuItemIcon}${prefix}traidor${isLiteMode ? '' : `\n${middleBorder}${menuItemIcon}${prefix}bandido${isLiteMode ? '' : `\n${middleBorder}${menuItemIcon}${prefix}cachorro${isLiteMode ? '' : `\n${middleBorder}${menuItemIcon}${prefix}vagabundo${isLiteMode ? '' : `\n${middleBorder}${menuItemIcon}${prefix}pilantra`}`}`}`}`}`}`}`}`}
${middleBorder}${menuItemIcon}${prefix}mito
${middleBorder}${menuItemIcon}${prefix}padrao
${middleBorder}${menuItemIcon}${prefix}comedia${isLiteMode ? '' : `\n${middleBorder}${menuItemIcon}${prefix}psicopata`}
${middleBorder}${menuItemIcon}${prefix}fortao
${middleBorder}${menuItemIcon}${prefix}magrelo
${middleBorder}${menuItemIcon}${prefix}bombado
${middleBorder}${menuItemIcon}${prefix}chefe
${middleBorder}${menuItemIcon}${prefix}presidente
${middleBorder}${menuItemIcon}${prefix}rei
${middleBorder}${menuItemIcon}${prefix}patrao
${middleBorder}${menuItemIcon}${prefix}playboy
${middleBorder}${menuItemIcon}${prefix}zueiro
${middleBorder}${menuItemIcon}${prefix}gamer
${middleBorder}${menuItemIcon}${prefix}programador
${middleBorder}${menuItemIcon}${prefix}visionario
${middleBorder}${menuItemIcon}${prefix}billionario
${middleBorder}${menuItemIcon}${prefix}poderoso
${middleBorder}${menuItemIcon}${prefix}vencedor
${middleBorder}${menuItemIcon}${prefix}senhor
${bottomBorder}

${menuTopBorder}${separatorIcon} *${femaleFunMenuTitle}*
${middleBorder}
${isLiteMode ? '' : `${middleBorder}${menuItemIcon}${prefix}lésbica\n`}${middleBorder}${menuItemIcon}${prefix}burra
${middleBorder}${menuItemIcon}${prefix}inteligente
${middleBorder}${menuItemIcon}${prefix}otaku
${middleBorder}${menuItemIcon}${prefix}fiel
${middleBorder}${menuItemIcon}${prefix}infiel${isLiteMode ? '' : `\n${middleBorder}${menuItemIcon}${prefix}corna`}
${middleBorder}${menuItemIcon}${prefix}gada
${middleBorder}${menuItemIcon}${prefix}gostosa
${middleBorder}${menuItemIcon}${prefix}feia
${middleBorder}${menuItemIcon}${prefix}rica
${middleBorder}${menuItemIcon}${prefix}pobre${isLiteMode ? '' : `\n${middleBorder}${menuItemIcon}${prefix}bucetuda${isLiteMode ? '' : `\n${middleBorder}${menuItemIcon}${prefix}nazista${isLiteMode ? '' : `\n${middleBorder}${menuItemIcon}${prefix}ladra`}`}`}
${middleBorder}${menuItemIcon}${prefix}safada
${middleBorder}${menuItemIcon}${prefix}vesga
${middleBorder}${menuItemIcon}${prefix}bêbada${isLiteMode ? '' : `\n${middleBorder}${menuItemIcon}${prefix}machista${isLiteMode ? '' : `\n${middleBorder}${menuItemIcon}${prefix}homofóbica${isLiteMode ? '' : `\n${middleBorder}${menuItemIcon}${prefix}racista`}`}`}
${middleBorder}${menuItemIcon}${prefix}chata
${middleBorder}${menuItemIcon}${prefix}sortuda
${middleBorder}${menuItemIcon}${prefix}azarada
${middleBorder}${menuItemIcon}${prefix}forte
${middleBorder}${menuItemIcon}${prefix}fraca
${middleBorder}${menuItemIcon}${prefix}pegadora
${middleBorder}${menuItemIcon}${prefix}otária
${middleBorder}${menuItemIcon}${prefix}boba
${middleBorder}${menuItemIcon}${prefix}nerd
${middleBorder}${menuItemIcon}${prefix}preguiçosa
${middleBorder}${menuItemIcon}${prefix}trabalhadora
${middleBorder}${menuItemIcon}${prefix}braba
${middleBorder}${menuItemIcon}${prefix}linda
${middleBorder}${menuItemIcon}${prefix}malandra
${middleBorder}${menuItemIcon}${prefix}simpática
${middleBorder}${menuItemIcon}${prefix}engraçada
${middleBorder}${menuItemIcon}${prefix}charmosa
${middleBorder}${menuItemIcon}${prefix}misteriosa
${middleBorder}${menuItemIcon}${prefix}carinhosa
${middleBorder}${menuItemIcon}${prefix}desumilde
${middleBorder}${menuItemIcon}${prefix}humilde
${middleBorder}${menuItemIcon}${prefix}ciumenta
${middleBorder}${menuItemIcon}${prefix}corajosa
${middleBorder}${menuItemIcon}${prefix}covarde
${middleBorder}${menuItemIcon}${prefix}esperta${isLiteMode ? '' : `\n${middleBorder}${menuItemIcon}${prefix}talarica`}
${middleBorder}${menuItemIcon}${prefix}chorona
${middleBorder}${menuItemIcon}${prefix}brincalhona${isLiteMode ? '' : `\n${middleBorder}${menuItemIcon}${prefix}bolsonarista${isLiteMode ? '' : `\n${middleBorder}${menuItemIcon}${prefix}petista${isLiteMode ? '' : `\n${middleBorder}${menuItemIcon}${prefix}comunista${isLiteMode ? '' : `\n${middleBorder}${menuItemIcon}${prefix}lulista${isLiteMode ? '' : `\n${middleBorder}${menuItemIcon}${prefix}traidora${isLiteMode ? '' : `\n${middleBorder}${menuItemIcon}${prefix}bandida${isLiteMode ? '' : `\n${middleBorder}${menuItemIcon}${prefix}cachorra${isLiteMode ? '' : `\n${middleBorder}${menuItemIcon}${prefix}vagabunda${isLiteMode ? '' : `\n${middleBorder}${menuItemIcon}${prefix}pilantra`}`}`}`}`}`}`}`}`}
${middleBorder}${menuItemIcon}${prefix}mito
${middleBorder}${menuItemIcon}${prefix}padrão
${middleBorder}${menuItemIcon}${prefix}comédia${isLiteMode ? '' : `\n${middleBorder}${menuItemIcon}${prefix}psicopata`}
${middleBorder}${menuItemIcon}${prefix}fortona
${middleBorder}${menuItemIcon}${prefix}magrela
${middleBorder}${menuItemIcon}${prefix}bombada
${middleBorder}${menuItemIcon}${prefix}chefe
${middleBorder}${menuItemIcon}${prefix}presidenta
${middleBorder}${menuItemIcon}${prefix}rainha
${middleBorder}${menuItemIcon}${prefix}patroa
${middleBorder}${menuItemIcon}${prefix}playgirl
${middleBorder}${menuItemIcon}${prefix}zueira
${middleBorder}${menuItemIcon}${prefix}gamer
${middleBorder}${menuItemIcon}${prefix}programadora
${middleBorder}${menuItemIcon}${prefix}visionária
${middleBorder}${menuItemIcon}${prefix}bilionária
${middleBorder}${menuItemIcon}${prefix}poderosa
${middleBorder}${menuItemIcon}${prefix}vencedora
${middleBorder}${menuItemIcon}${prefix}senhora
${bottomBorder}

${menuTopBorder}${separatorIcon} *${maleRanksMenuTitle}*
${middleBorder}
${middleBorder}${menuItemIcon}${prefix}rankgay
${middleBorder}${menuItemIcon}${prefix}rankburro
${middleBorder}${menuItemIcon}${prefix}rankinteligente
${middleBorder}${menuItemIcon}${prefix}rankotaku
${middleBorder}${menuItemIcon}${prefix}rankfiel
${middleBorder}${menuItemIcon}${prefix}rankinfiel
${middleBorder}${menuItemIcon}${prefix}rankcorno
${middleBorder}${menuItemIcon}${prefix}rankgado
${middleBorder}${menuItemIcon}${prefix}rankgostoso
${middleBorder}${menuItemIcon}${prefix}rankrico
${middleBorder}${menuItemIcon}${prefix}rankpobre
${middleBorder}${menuItemIcon}${prefix}rankforte
${middleBorder}${menuItemIcon}${prefix}rankpegador
${middleBorder}${menuItemIcon}${prefix}rankmacho
${middleBorder}${menuItemIcon}${prefix}ranknerd
${middleBorder}${menuItemIcon}${prefix}ranktrabalhador
${middleBorder}${menuItemIcon}${prefix}rankbrabo
${middleBorder}${menuItemIcon}${prefix}ranklindo
${middleBorder}${menuItemIcon}${prefix}rankmalandro
${middleBorder}${menuItemIcon}${prefix}rankengracado
${middleBorder}${menuItemIcon}${prefix}rankcharmoso
${middleBorder}${menuItemIcon}${prefix}rankvisionario
${middleBorder}${menuItemIcon}${prefix}rankpoderoso
${middleBorder}${menuItemIcon}${prefix}rankvencedor
${bottomBorder}

${menuTopBorder}${separatorIcon} *${femaleRanksMenuTitle}*
${middleBorder}
${middleBorder}${menuItemIcon}${prefix}ranklesbica
${middleBorder}${menuItemIcon}${prefix}rankburra
${middleBorder}${menuItemIcon}${prefix}rankinteligente
${middleBorder}${menuItemIcon}${prefix}rankotaku
${middleBorder}${menuItemIcon}${prefix}rankfiel
${middleBorder}${menuItemIcon}${prefix}rankinfiel
${middleBorder}${menuItemIcon}${prefix}rankcorna
${middleBorder}${menuItemIcon}${prefix}rankgada
${middleBorder}${menuItemIcon}${prefix}rankgostosa
${middleBorder}${menuItemIcon}${prefix}rankrica
${middleBorder}${menuItemIcon}${prefix}rankpobre
${middleBorder}${menuItemIcon}${prefix}rankforte
${middleBorder}${menuItemIcon}${prefix}rankpegadora
${middleBorder}${menuItemIcon}${prefix}ranknerd
${middleBorder}${menuItemIcon}${prefix}ranktrabalhadora
${middleBorder}${menuItemIcon}${prefix}rankbraba
${middleBorder}${menuItemIcon}${prefix}ranklinda
${middleBorder}${menuItemIcon}${prefix}rankmalandra
${middleBorder}${menuItemIcon}${prefix}rankengracada
${middleBorder}${menuItemIcon}${prefix}rankcharmosa
${middleBorder}${menuItemIcon}${prefix}rankvisionaria
${middleBorder}${menuItemIcon}${prefix}rankpoderosa
${middleBorder}${menuItemIcon}${prefix}rankvencedora
${bottomBorder}
`;

  return menuContent;
}

module.exports = menubn;