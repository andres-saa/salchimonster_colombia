import { getCountries, getCountryCallingCode } from 'libphonenumber-js'
// 1. CORRECCIÓN: Cambiar 'import * as ...' por 'import ...' 
// Esto asegura que accedas directamente al objeto que contiene las funciones
import isoCountries from 'i18n-iso-countries'

import en from 'i18n-iso-countries/langs/en.json'
import es from 'i18n-iso-countries/langs/es.json'

// 2. Registro de idiomas
// El 'as any' está bien para evitar conflictos de tipos estrictos en JSON
isoCountries.registerLocale(en as any)
isoCountries.registerLocale(es as any)

export type CountryOption = {
  code: string;   // "US", "CO"
  name: string;   // "United States", "Colombia"
  dialCode: string; // "+1", "+57"
  flag: string;   // flagcdn url
  label: string;  // mostrado en el Select
  dialDigits?: string; // "1", "57"
}

export function buildCountryOptions(locale: 'es'|'en' = 'es'): CountryOption[] {
  const codes = getCountries()
  
  const opts: CountryOption[] = codes.map(code => {
    // 3. Uso directo de isoCountries (que ahora es el objeto correcto)
    const name = isoCountries.getName(code, locale) || code
    const dial = '+' + getCountryCallingCode(code)
    const flag = `https://flagcdn.com/w20/${code.toLowerCase()}.png`
    
    return {
      code,
      name,
      dialCode: dial,
      flag,
      label: `${dial}`,
      dialDigits: dial.replace(/\D+/g, '')
    }
  })

  // Ordenar alfabéticamente
  opts.sort((a, b) => a.name.localeCompare(b.name, locale))
  
  return opts
}