import type { CommissionSettings, FeeSettings, NetworkSettings } from './types'

/*
 * Default parameters for the cost calculators and the commission sharing.
 * Reviewed in October 2026. Everything is editable from the dashboard (Settings).
 *
 * Sources:
 *  - Code général des impôts, art. 133 (registration duties): 4 % built property, 5 % bare land,
 *    3 % first sale of social / low-value housing — DGI tax guide for Moroccans abroad, 2025.
 *  - Loi de finances 2026 n° 50-25, DGI note circulaire n° 737: extra 2 % on the part of the price
 *    paid in cash when the price exceeds 300 000 DH, deeds from 1 July 2026; mortgage deeds and
 *    their release: fixed duty of 200 DH.
 *  - Décret n° 2.16.375 (tarif des droits de conservation foncière, as amended), ANCFCC:
 *    sale 1.5 % + 100 DH per title, minimum 500 DH; mortgage 0.5 % up to 250 000 DH,
 *    1.5 % from 250 001 to 5 000 000 DH, 0.5 % above, + 100 DH; mortgage release 500 DH;
 *    certificate 100 DH.
 *  - CGI art. 63, 65, 73, 144 (profits fonciers): 20 % of the net profit, minimum 3 % of the price;
 *    main residence for at least 5 years exempt (LF 2023), minimum 3 % on the part above 4 000 000 DH;
 *    sales up to 140 000 DH a year exempt; first sale of social housing occupied 4 years exempt;
 *    acquisition costs: actual or a flat 15 % of the price.
 *  - Revaluation coefficients for 2026: arrêté of the Minister of Economy and Finance of
 *    6 February 2026, Bulletin officiel n° 7486.
 *  - Notary fees: no published scale in force (draft decree 2.17.481 of 2017 sets caps);
 *    common practice about 1 % with a minimum, plus VAT 10 % on the fees.
 *  - Agency fees: not set by law (Code de commerce art. 405 to 422 on brokerage); usual practice
 *    2.5 % excluding VAT from each party for a sale, one month of rent from each party for a
 *    long-term rental. Rates vary by region, written agreements are recommended.
 */

export const COEFFICIENTS_2026: Record<string, number> = {
  '1946': 57.773, '1947': 44.991, '1948': 31.717, '1949': 25.479, '1950': 24.885,
  '1951': 22.105, '1952': 18.862, '1953': 18.262, '1954': 19.916, '1955': 18.862,
  '1956': 16.018, '1957': 16.88, '1958': 13.803, '1959': 13.803, '1960': 13.28,
  '1961': 12.671, '1962': 12.459, '1963': 11.463, '1964': 11.032, '1965': 10.66,
  '1966': 10.705, '1967': 10.898, '1968': 10.822, '1969': 10.453, '1970': 10.348,
  '1971': 9.87, '1972': 9.366, '1973': 9.247, '1974': 8.264, '1975': 7.16,
  '1976': 6.536, '1977': 6.016, '1978': 5.407, '1979': 5.02, '1980': 4.646,
  '1981': 4.143, '1982': 3.722, '1983': 3.576, '1984': 3.085, '1985': 2.921,
  '1986': 2.655, '1987': 2.609, '1988': 2.55, '1989': 2.46, '1990': 2.3,
  '1991': 2.101, '1992': 1.999, '1993': 1.896, '1994': 1.819, '1995': 1.732,
  '1996': 1.686, '1997': 1.673, '1998': 1.628, '1999': 1.614, '2000': 1.585,
  '2001': 1.569, '2002': 1.536, '2003': 1.523, '2004': 1.492, '2005': 1.478,
  '2006': 1.432, '2007': 1.402, '2008': 1.351, '2009': 1.309, '2010': 1.296,
  '2011': 1.285, '2012': 1.27, '2013': 1.248, '2014': 1.243, '2015': 1.223,
  '2016': 1.205, '2017': 1.196, '2018': 1.175, '2019': 1.173, '2020': 1.164,
  '2021': 1.15, '2022': 1.078, '2023': 1.017, '2024': 1.008, '2025': 1,
}

export const DEFAULT_FEES: FeeSettings = {
  reviewed_at: '2026-10-26',
  registration: { built: 4, land: 5, social: 3, cash_extra: 2, cash_threshold: 300_000, cash_from: '2026-07-01' },
  conservation: { rate: 1.5, fixed: 100, min: 500, certificate: 100 },
  notary: { rate: 1, min: 4_000, vat: 10, disbursements: 1_500 },
  loan: {
    brackets: [
      { upTo: 250_000, rate: 0.5 },
      { upTo: 5_000_000, rate: 1.5 },
      { upTo: null, rate: 0.5 },
    ],
    fixed: 100,
    registration: 200,
    bank_rate: 0.5,
    notary_rate: 0.5,
  },
  release: { conservation: 500, registration: 200 },
  tpi: {
    rate: 20,
    min_rate: 3,
    residence_years: 5,
    residence_cap: 4_000_000,
    social_years: 4,
    social_cap: 250_000,
    small_cap: 140_000,
    flat_costs: 15,
    coef_year: 2026,
    coefficients: COEFFICIENTS_2026,
  },
  aid: {
    enabled: true,
    until: 2028,
    tiers: [
      { upTo: 300_000, amount: 100_000 },
      { upTo: 700_000, amount: 70_000 },
    ],
  },
}

export const DEFAULT_COMMISSION: CommissionSettings = {
  sale_buyer: 2.5,
  sale_seller: 2.5,
  rent_tenant: 1,
  rent_owner: 1,
  vat: 0,
  min_amount: 0,
}

export const DEFAULT_NETWORK: NetworkSettings = {
  listing_share: 50,
  client_share: 50,
  referrer_share: 10,
  staff_bonus: 0,
}
