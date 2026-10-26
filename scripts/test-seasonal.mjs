// npm run test:seasonal — price of a stay, availability, occupancy and the agency's share.
import { addDays, agencyCut, bookingRest, clashes, DEFAULT_SEASON, fromNight, guestsText, holds, isFree, isHigh, movements, nightsBetween, nightsOf, nightsText, occupancy, ownerPayout, quote, seasonalFees, seasonOf, stayMessage, takenNights } from '../src/shared/lib/seasonal.ts'

let pass = 0
let fail = 0
const ok = (name, cond, extra = '') => {
  if (cond) pass++
  else fail++
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  -> ' + extra : ''}`)
}

// ------------------------------------------------------------ dates
ok('nights between, across months and years', nightsBetween('2026-07-30', '2026-08-02') === 3 && nightsBetween('2026-12-30', '2027-01-02') === 3 && nightsBetween('2026-08-02', '2026-07-30') === 0)
ok('each night of a stay (departure day excluded)', nightsOf('2026-07-30', '2026-08-02').join(',') === '2026-07-30,2026-07-31,2026-08-01')
ok('add days', addDays('2026-02-27', 2) === '2026-03-01' && addDays('2028-02-28', 1) === '2028-02-29')

// ------------------------------------------------------------ seasons
const r = seasonOf({ night: 800, high_night: 1400, high_from: '07-01', high_to: '08-31', week_discount: 10, min_nights: 2, high_min_nights: 5, guests: 6, cleaning: 300, deposit_pct: 30, caution: 2000, commission: 20 })
ok('settings added later keep their default', seasonOf({ night: 500 }).check_in === DEFAULT_SEASON.check_in && seasonOf(null).night === 0)
ok('high season inside the range', isHigh('2026-07-01', r) && isHigh('2026-08-31', r) && !isHigh('2026-06-30', r) && !isHigh('2026-09-01', r))
ok('a high season across the new year', isHigh('2026-12-28', { high_night: 1, high_from: '12-20', high_to: '01-05' }) && isHigh('2027-01-03', { high_night: 1, high_from: '12-20', high_to: '01-05' }) && !isHigh('2027-01-10', { high_night: 1, high_from: '12-20', high_to: '01-05' }))
ok('price «from» = the cheapest night', fromNight(r) === 800 && fromNight({ night: 900, high_night: null }) === 900 && fromNight({ night: 900, high_night: 700 }) === 700)
ok('no high price: no high season', !isHigh('2026-07-15', { high_night: null, high_from: '07-01', high_to: '08-31' }))

// ------------------------------------------------------------ quotes
const q1 = quote(r, '2026-06-27', '2026-07-02', 4) // 4 low nights (27, 28, 29, 30 June) + 1 high (1 July)
ok('mixed stay: low and high nights', q1.nights === 5 && q1.low === 4 && q1.high === 1 && q1.subtotal === 4 * 800 + 1400, JSON.stringify(q1))
ok('cleaning added, deposit 30 % rounded to 10', q1.total === 4600 + 300 && q1.deposit === Math.round((4900 * 0.3) / 10) * 10 && q1.caution === 2000)
ok('high season involved: minimum 5 nights met', !q1.issues.includes('min_nights') && q1.minNights === 5)
const q2 = quote(r, '2026-08-01', '2026-08-04', 2)
ok('3 nights in August: below the summer minimum', q2.issues.includes('min_nights') && q2.minNights === 5)
const q3 = quote(r, '2026-08-01', '2026-08-15', 6)
ok('two weeks in August: weekly discount 10 %', q3.nights === 14 && q3.subtotal === 14 * 1400 && q3.discount === 1960 && q3.rent === 17640 && q3.total === 17940, JSON.stringify(q3))
ok('too many guests', quote(r, '2026-10-01', '2026-10-04', 7).issues.includes('guests'))
ok('no dates', quote(r, '2026-10-04', '2026-10-04').issues.includes('dates') && quote(r, '', '').nights === 0)
ok('no price set', quote(seasonOf({}), '2026-10-01', '2026-10-03').issues.includes('no_rate'))
ok('out of season: minimum 2 nights', quote(r, '2026-10-01', '2026-10-02').issues.includes('min_nights') && !quote(r, '2026-10-01', '2026-10-03').issues.includes('min_nights'))

// ------------------------------------------------------------ availability
const B = (id, check_in, check_out, status = 'confirmed', property_id = 'P', extra = {}) => ({ id, property_id, status, check_in, check_out, rent: 0, cleaning: 0, paid: 0, commission_rate: 0, ...extra })
const list = [B('a', '2026-08-01', '2026-08-08'), B('b', '2026-08-10', '2026-08-12', 'request'), B('c', '2026-08-15', '2026-08-20', 'blocked'), B('d', '2026-08-08', '2026-08-09', 'cancelled'), B('e', '2026-08-01', '2026-08-31', 'confirmed', 'Q')]
ok('requests and cancelled stays do not hold dates', holds({ status: 'blocked' }) && !holds({ status: 'request' }) && !holds({ status: 'cancelled' }))
ok('a stay may start the day another ends', isFree(list, 'P', '2026-08-08', '2026-08-10'))
ok('overlap refused', !isFree(list, 'P', '2026-08-07', '2026-08-09') && !isFree(list, 'P', '2026-08-16', '2026-08-17'))
ok('a request does not block', isFree(list, 'P', '2026-08-10', '2026-08-12'))
ok('another property is independent', isFree(list, 'P', '2026-08-25', '2026-08-30') && !isFree(list, 'Q', '2026-08-25', '2026-08-30'))
ok('editing a stay ignores itself', isFree(list, 'P', '2026-08-02', '2026-08-06', 'a'))
const taken = takenNights(list.filter((b) => b.property_id === 'P' && holds(b)))
ok('website dates clash with a taken stay, not back to back', clashes([{ check_in: '2026-08-01', check_out: '2026-08-08' }], '2026-08-07', '2026-08-10') && !clashes([{ check_in: '2026-08-01', check_out: '2026-08-08' }], '2026-08-08', '2026-08-10') && !clashes([], '2026-08-01', '2026-08-02'))
ok('taken nights for the calendar', taken.has('2026-08-07') && !taken.has('2026-08-08') && taken.has('2026-08-19') && taken.size === 12, String(taken.size))

// ------------------------------------------------------------ occupancy and money
const occ = occupancy(list, ['P', 'Q'], '2026-08-01', '2026-09-01')
ok('August occupancy: booked / (nights − owner use)', occ.booked === 7 + 30 && occ.available === 62 - 5 && occ.rate === Math.round((37 / 57) * 100), JSON.stringify(occ))
const stay = { rent: 17640, cleaning: 300, paid: 5000, commission_rate: 20 }
ok('agency 20 % of the nights, owner the rest', agencyCut(stay) === 3528 && ownerPayout(stay) === 14112)
ok('rest to pay', bookingRest(stay) === 12940 && bookingRest({ ...stay, paid: 20000 }) === 0)
const fees = seasonalFees([{ status: 'confirmed', check_in: '2026-08-01', rent: 10000, commission_rate: 15 }, { status: 'request', check_in: '2026-08-05', rent: 9999, commission_rate: 15 }, { status: 'blocked', check_in: '2026-08-09', rent: 0, commission_rate: 15 }])
ok('income: confirmed stays only, at arrival', fees.length === 1 && fees[0].amount === 1500 && fees[0].date === '2026-08-01')
const mv = movements(list, '2026-08-08')
ok('movements of a day', mv.departures.length === 1 && mv.departures[0].id === 'a' && mv.arrivals.length === 0)

// ------------------------------------------------------------ messages
ok('Arabic counts', nightsText(1, 'ar') === 'ليلة واحدة' && nightsText(2, 'ar') === 'ليلتان' && nightsText(5, 'ar') === '5 ليالٍ' && nightsText(14, 'ar') === '14 ليلة' && guestsText(2, 'ar') === 'شخصان' && guestsText(6, 'ar') === '6 أشخاص')
ok('French and Spanish counts', nightsText(1, 'fr') === '1 nuit' && nightsText(3, 'fr') === '3 nuits' && nightsText(2, 'es') === '2 noches' && guestsText(1, 'es') === '1 persona')
const v = { name: 'Karim Tahiri', place: 'Martil', ref: 'SH-1010', checkIn: '2027-08-02', checkOut: '2027-08-09', guests: 6, total: '9 800 DH', deposit: '2 940 DH', paid: '2 940 DH', checkInTime: '15:00', checkOutTime: '12:00', agency: 'Sweet House' }
const fr = stayMessage('confirmed', 'fr', v)
ok('French confirmation: dates, nights, total, paid, times', fr.startsWith('Bonjour Karim') && fr.includes('7 nuits') && fr.includes('6 personnes') && fr.includes('9 800 DH, dont 2 940 DH déjà réglés') && fr.includes('à partir de 15:00') && fr.includes('lundi 2 août'), fr)
const ar = stayMessage('request', 'ar', { ...v, name: 'كريم الطاهري', paid: null })
ok('Arabic request with the deposit to pay', ar.startsWith('السلام عليكم كريم') && ar.includes('7 ليالٍ') && ar.includes('2 940 DH') && ar.includes('أغسطس') === false && ar.includes('غشت'), ar)
ok('reminder asks for ID documents', stayMessage('reminder', 'es', v).includes('documento de identidad'))

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
