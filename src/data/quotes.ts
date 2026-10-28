/**
 * "Backpack Daily" — curated quotes in four moods, translated for each UI
 * language. Contested attributions are marked as such; house lines are
 * credited to Backpack.
 */
import type { UiLang } from '@/lib/settings'

export type QuoteCategory = 'humorous' | 'motivational' | 'adventurous' | 'witty'

export interface Quote {
  id: string
  cat: QuoteCategory
  author: string
  attributed?: boolean
  text: Record<UiLang, string>
}

const q = (id: string, cat: QuoteCategory, author: string, en: string, de: string, tr: string, ru: string, attributed = false): Quote => ({
  id,
  cat,
  author,
  attributed,
  text: { en, de, tr, ru },
})

export const QUOTES: Quote[] = [
  // Adventurous
  q('book', 'adventurous', 'Saint Augustine', 'The world is a book, and those who do not travel read only one page.', 'Die Welt ist ein Buch. Wer nie reist, sieht nur eine Seite davon.', 'Dünya bir kitaptır; seyahat etmeyenler yalnızca bir sayfasını okur.', 'Мир — это книга, и тот, кто не путешествует, читает лишь одну её страницу.', true),
  q('wander', 'adventurous', 'J.R.R. Tolkien', 'Not all those who wander are lost.', 'Nicht jeder, der umherwandert, ist verloren.', 'Her gezgin kaybolmuş değildir.', 'Не всякий, кто странствует, потерян.'),
  q('daring', 'adventurous', 'Helen Keller', 'Life is either a daring adventure or nothing.', 'Das Leben ist entweder ein waghalsiges Abenteuer oder gar nichts.', 'Hayat ya cesur bir maceradır ya da hiçbir şey.', 'Жизнь — это либо дерзкое приключение, либо ничто.'),
  q('step', 'adventurous', 'Lao Tzu', 'A journey of a thousand miles begins with a single step.', 'Auch eine Reise von tausend Meilen beginnt mit einem ersten Schritt.', 'Bin millik bir yolculuk tek bir adımla başlar.', 'Путь в тысячу ли начинается с первого шага.'),
  q('live', 'adventurous', 'Hans Christian Andersen', 'To travel is to live.', 'Reisen heißt leben.', 'Seyahat etmek yaşamaktır.', 'Путешествовать — значит жить.'),
  q('earhart', 'adventurous', 'Amelia Earhart', 'Adventure is worthwhile in itself.', 'Abenteuer ist an sich schon lohnenswert.', 'Macera, kendi başına değerlidir.', 'Приключение ценно само по себе.'),
  q('lost', 'adventurous', 'Henry David Thoreau', 'Not until we are lost do we begin to understand ourselves.', 'Erst wenn wir uns verirrt haben, beginnen wir, uns selbst zu verstehen.', 'Kendimizi ancak kaybolduğumuzda anlamaya başlarız.', 'Лишь заблудившись, мы начинаем понимать себя.'),
  q('never', 'adventurous', 'Dalai Lama', 'Once a year, go someplace you have never been before.', 'Fahre einmal im Jahr an einen Ort, an dem du noch nie warst.', 'Yılda bir kez, daha önce hiç gitmediğin bir yere git.', 'Раз в год отправляйся туда, где ты никогда не был.', true),
  // Motivational
  q('impossible', 'motivational', 'Nelson Mandela', 'It always seems impossible until it is done.', 'Es scheint immer unmöglich, bis es getan ist.', 'Bir şey bitene kadar hep imkânsız görünür.', 'Всегда кажется, что это невозможно, пока не сделаешь.', true),
  q('through', 'motivational', 'Robert Frost', 'The best way out is always through.', 'Der beste Ausweg führt immer mitten hindurch.', 'En iyi çıkış yolu her zaman içinden geçmektir.', 'Лучший выход — всегда пройти насквозь.'),
  q('whatyouhave', 'motivational', 'Theodore Roosevelt', 'Do what you can, with what you have, where you are.', 'Tu, was du kannst, mit dem, was du hast, dort, wo du bist.', 'Olduğun yerde, elindekiyle, yapabildiğini yap.', 'Делай что можешь, тем, что имеешь, там, где ты есть.'),
  q('seven', 'motivational', 'Japanese proverb', 'Fall seven times, stand up eight.', 'Siebenmal fallen, achtmal aufstehen.', 'Yedi kez düş, sekiz kez kalk.', 'Упади семь раз, встань восемь.'),
  q('begin', 'motivational', 'Goethe', 'Whatever you can do or dream you can, begin it.', 'Was immer du tun kannst oder träumst, es zu können, fang damit an.', 'Yapabileceğin ya da yapabileceğini hayal ettiğin her neyse, başla.', 'Что бы ты ни мог сделать или мечтал бы сделать — начни.', true),
  q('escape', 'motivational', 'Anonymous', 'We travel not to escape life, but for life not to escape us.', 'Wir reisen nicht, um dem Leben zu entfliehen, sondern damit das Leben uns nicht entflieht.', 'Hayattan kaçmak için değil, hayat bizden kaçmasın diye seyahat ederiz.', 'Мы путешествуем не чтобы сбежать от жизни, а чтобы жизнь не сбежала от нас.'),
  q('jobs', 'motivational', 'Jaime Lyn Beatty', 'Jobs fill your pocket, adventures fill your soul.', 'Jobs füllen die Taschen, Abenteuer die Seele.', 'İş cebini doldurur, maceralar ruhunu.', 'Работа наполняет карман, приключения — душу.'),
  q('moments', 'motivational', 'Anonymous', 'Collect moments, not things.', 'Sammle Momente, keine Dinge.', 'Eşya değil, anı biriktir.', 'Собирай моменты, а не вещи.'),
  // Humorous
  q('list', 'humorous', 'Susan Sontag', "I haven't been everywhere, but it's on my list.", 'Ich war noch nicht überall, aber es steht auf meiner Liste.', 'Her yere gitmedim ama hepsi listemde.', 'Я ещё не везде побывал, но всё это есть в моём списке.'),
  q('money', 'humorous', 'Susan Heller', 'When preparing to travel, lay out all your clothes and all your money. Then take half the clothes and twice the money.', 'Leg vor der Reise alle Kleider und alles Geld bereit. Dann nimm die Hälfte der Kleider und das Doppelte an Geld.', 'Seyahate hazırlanırken tüm kıyafetlerini ve paranı ser. Sonra kıyafetlerin yarısını, paranın iki katını al.', 'Собираясь в поездку, разложи всю одежду и все деньги. Потом возьми половину одежды и вдвое больше денег.'),
  q('bunk', 'humorous', 'Backpack', 'Hostel law: whoever leaves at 5 a.m. has the crinkliest plastic bag.', 'Hostel-Gesetz: Wer um 5 Uhr aufbricht, hat die raschelndste Plastiktüte.', 'Hostel kanunu: Sabah 5\'te çıkanın poşeti hep en hışırtılısıdır.', 'Закон хостела: у того, кто уходит в 5 утра, самый шуршащий пакет.'),
  q('fivemin', 'humorous', 'Backpack', 'The map says five minutes. Your legs have a second opinion.', 'Die Karte sagt fünf Minuten. Deine Beine sehen das anders.', 'Harita beş dakika diyor. Bacakların başka fikirde.', 'Карта говорит: пять минут. У ваших ног другое мнение.'),
  q('local', 'humorous', 'Backpack', "I'm not a tourist. I'm a temporary local with a very large bag.", 'Ich bin kein Tourist. Ich bin ein vorübergehender Einheimischer mit sehr großem Rucksack.', 'Turist değilim. Çok büyük çantası olan geçici bir yerliyim.', 'Я не турист. Я временный местный с очень большим рюкзаком.'),
  q('overpack', 'humorous', 'Backpack', 'Packing tip: if you are not sure you need it, your shoulders will let you know by day two.', 'Packtipp: Wenn du nicht sicher bist, ob du es brauchst, sagen es dir deine Schultern spätestens an Tag zwei.', 'Bavul ipucu: İhtiyacın olup olmadığından emin değilsen, omuzların ikinci gün sana söyler.', 'Совет по сборам: если сомневаешься, нужно ли это, плечи сообщат тебе на второй день.'),
  q('wifi', 'humorous', 'Backpack', 'Home is where the Wi-Fi connects automatically.', 'Zuhause ist da, wo sich das WLAN automatisch verbindet.', 'Ev, Wi-Fi\'ın otomatik bağlandığı yerdir.', 'Дом — это там, где Wi-Fi подключается сам.'),
  q('noplans', 'humorous', 'Lao Tzu', 'A good traveler has no fixed plans and is not intent on arriving.', 'Ein guter Reisender hat keine festen Pläne und will nicht unbedingt ankommen.', 'İyi bir gezginin kesin planları yoktur ve varmaya hevesli değildir.', 'У хорошего путника нет твёрдых планов, и он не стремится прибыть.'),
  // Witty
  q('prejudice', 'witty', 'Mark Twain', 'Travel is fatal to prejudice, bigotry, and narrow-mindedness.', 'Reisen ist tödlich für Vorurteile, Engstirnigkeit und Borniertheit.', 'Seyahat; önyargıya, bağnazlığa ve dar görüşlülüğe ölümcül darbedir.', 'Путешествия губительны для предрассудков, фанатизма и узости взглядов.'),
  q('modest', 'witty', 'Gustave Flaubert', 'Travel makes one modest. You see what a tiny place you occupy in the world.', 'Reisen macht bescheiden. Man sieht, welch winzigen Platz man in der Welt einnimmt.', 'Seyahat insanı alçakgönüllü yapar; dünyada ne kadar küçük bir yer kapladığını görürsün.', 'Путешествия делают человека скромным: видишь, какое крошечное место занимаешь в мире.'),
  q('alone', 'witty', 'Henry David Thoreau', 'The man who goes alone can start today; but he who travels with another must wait till that other is ready.', 'Wer allein geht, kann heute aufbrechen; wer mit anderen reist, muss warten, bis der andere bereit ist.', 'Yalnız giden bugün yola çıkabilir; başkasıyla giden ise onun hazır olmasını beklemek zorundadır.', 'Тот, кто идёт один, может выйти сегодня; тот, кто путешествует с другим, должен ждать, пока другой будет готов.'),
  q('imagination', 'witty', 'Samuel Johnson', 'The use of traveling is to regulate imagination by reality.', 'Der Nutzen des Reisens besteht darin, die Fantasie an der Wirklichkeit zu messen.', 'Seyahatin faydası, hayal gücünü gerçeklikle dengelemektir.', 'Польза путешествий в том, чтобы сверять воображение с реальностью.'),
  q('passport', 'witty', 'Anonymous', 'The best stories are found between the pages of a passport.', 'Die besten Geschichten stehen zwischen den Seiten eines Reisepasses.', 'En güzel hikâyeler pasaportun sayfaları arasında saklıdır.', 'Лучшие истории хранятся между страницами паспорта.'),
  q('zen', 'witty', 'Robert M. Pirsig', 'The only Zen you find on the tops of mountains is the Zen you bring up there.', 'Das einzige Zen, das man auf Berggipfeln findet, ist das Zen, das man mit hinaufbringt.', 'Dağların tepesinde bulduğun tek Zen, oraya kendi götürdüğün Zen\'dir.', 'Единственный дзен, который находишь на вершинах гор, — это дзен, который ты туда принёс.'),
  q('detour', 'witty', 'Backpack', 'A wrong turn is just a detour with better stories.', 'Eine falsche Abzweigung ist nur ein Umweg mit besseren Geschichten.', 'Yanlış bir dönüş, daha iyi hikâyeleri olan bir sapaktır.', 'Неверный поворот — просто объезд с историями получше.'),
  q('souvenir', 'witty', 'Backpack', 'The best souvenir is the version of you that comes home.', 'Das beste Souvenir ist die Version von dir, die nach Hause kommt.', 'En iyi hatıra, eve dönen yeni hâlindir.', 'Лучший сувенир — та версия тебя, что возвращается домой.'),
]

/** Stable quote for a calendar day (same for everyone that day). */
export function quoteOfDay(date = new Date(), pool = QUOTES) {
  const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
  let h = 2166136261
  for (const ch of key) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  return pool[Math.abs(h) % pool.length]
}
