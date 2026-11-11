const DATE_LOCALES = {
  fr: 'fr-BE',
  en: 'en-GB',
  nl: 'nl-BE',
}

const WEEKDAY_INITIALS = {
  fr: ['L', 'M', 'M', 'J', 'V', 'S', 'D'],
  en: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
  nl: ['M', 'D', 'W', 'D', 'V', 'Z', 'Z'],
}

function getLanguageCode(language) {
  const code = (language || 'fr').slice(0, 2)
  return code in DATE_LOCALES ? code : 'fr'
}

export function getDateLocale(language) {
  return DATE_LOCALES[getLanguageCode(language)]
}

export function getWeekdayInitials(language) {
  return WEEKDAY_INITIALS[getLanguageCode(language)]
}