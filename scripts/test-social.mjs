// npm run test:social — ready-to-post texts, hashtags and review requests.
import { hashtag, postHashtags, propertyPost, reviewRequest } from '../src/shared/lib/social.ts'

let pass = 0
let fail = 0
const ok = (name, cond, extra = '') => {
  if (cond) pass++
  else fail++
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  -> ' + extra : ''}`)
}

ok('hashtag keeps Arabic letters, spaces become _', hashtag('وسط المدينة (الإنسانتشي)') === '#وسط_المدينة_الإنسانتشي', hashtag('وسط المدينة (الإنسانتشي)'))
ok('apostrophes removed (M’diq)', hashtag('M’diq') === '#Mdiq')
ok('accents kept', hashtag('Tétouan') === '#Tétouan')
ok('nothing left: no hashtag', hashtag('  ') === '')

const post = {
  purpose: 'sale',
  title: 'شقة فاخرة بإطلالة على البحر',
  ref: 'SH-1001',
  price: '1.150.000 د.م.',
  place: 'مرتيل',
  type: 'شقة',
  area: 98,
  bedrooms: 2,
  bathrooms: 2,
  features: ['مصعد', 'إطلالة على البحر', 'مسبح', 'موقف سيارات', 'تراس'],
  url: 'https://example.com/biens/SH-1001',
  phone: '07 02 87 30 88',
  agency: 'سويت هاوس',
  tags: ['مرتيل', 'تطوان'],
}
const ar = propertyPost(post, 'ar')
ok('Arabic post: kind, price, place, specs, ref, link', ar.startsWith('🏡 للبيع — شقة فاخرة') && ar.includes('💰 1.150.000 د.م.') && ar.includes('📍 مرتيل') && ar.includes('98 م² · 2 غرف نوم · 2 حمامات') && ar.includes('SH-1001') && ar.includes(post.url), ar)
ok('at most 4 features', (ar.match(/✨ (.*)/)?.[1].split(' · ').length ?? 0) === 4)
ok('hashtags on the last line, without duplicates', ar.trim().split('\n').pop().split(' ').every((h) => h.startsWith('#')) && postHashtags(post, 'ar').filter((h) => h === '#تطوان').length === 1, postHashtags(post, 'ar').join(' '))
ok('empty specs line left out', !propertyPost({ ...post, area: null, bedrooms: null, bathrooms: null }, 'ar').includes('📐'))
const fr = propertyPost({ ...post, purpose: 'rent', title: 'Appartement vue mer', price: '6 500 DH / mois', type: 'appartement', tags: ['Martil'] }, 'fr')
ok('French rental post', fr.startsWith('🏡 À louer — Appartement vue mer') && fr.includes('Réf. SH-1001') && fr.includes('#appartement_a_louer') && fr.includes('#Martil'), fr)
const es = propertyPost({ ...post, title: 'Piso con vistas', type: 'piso' }, 'es')
ok('Spanish post', es.startsWith('🏡 En venta — Piso con vistas') && es.includes('#piso_en_venta'), es)

const rv = reviewRequest('ar', 'أحمد العلمي', 'سويت هاوس للعقار', 'https://g.page/r/xyz/review')
ok('review request in Arabic, first name only, with the link', rv.startsWith('السلام عليكم أحمد،') && rv.endsWith('https://g.page/r/xyz/review'), rv)
ok('review request in French', reviewRequest('fr', 'Pierre Dubois', 'Sweet House', 'L').startsWith('Bonjour Pierre,'))

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
