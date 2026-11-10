import { Link } from 'react-router-dom'
import { ROUTER_BASENAME } from '@/config/base'

const features = [
  { icon: '◈', title: 'ميزانيتك تحت السيطرة', detail: 'تابع دخلك ومصاريفك وحدود الإنفاق في مكان واحد.' },
  { icon: '◎', title: 'أهداف واضحة', detail: 'قسّم خطط الادخار إلى أهداف قابلة للمتابعة.' },
  { icon: '◷', title: 'التزامات بدون نسيان', detail: 'رتّب فواتيرك ومواعيدك وشوف أولوياتك اليومية.' },
  { icon: '🏆', title: 'تحديات شهرية عادلة', detail: 'نافس على الالتزام المالي بدون مقارنة الرواتب أو كشف المبالغ.' },
]
export default function AboutPage() {
  return <div dir="rtl" className="min-h-dvh bg-[#f5f8f5] text-ink-900">
    <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
      <Link to="/about" className="text-2xl font-bold text-brand-700">دبّر ✦</Link>
      <div className="flex gap-3 text-sm font-bold"><Link to="/login" className="rounded-xl px-4 py-2 text-brand-700 hover:bg-brand-50">دخول</Link><Link to="/register" className="rounded-xl bg-brand-700 px-4 py-2 text-white hover:bg-brand-600">ابدأ مجانًا</Link></div>
    </header>
    <main>
      <section className="relative overflow-hidden bg-gradient-to-bl from-emerald-950 via-teal-900 to-emerald-700 px-5 py-20 text-white sm:py-28">
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2">
          <div><span className="rounded-full border border-white/25 bg-white/10 px-4 py-2 text-sm">تطبيق مالي شخصي بالعربي</span>
            <h1 className="mt-7 text-4xl font-bold leading-tight sm:text-6xl">فلوسك واضحة.<br/>وحياتك أرتب.</h1>
            <p className="mt-6 max-w-xl text-lg leading-9 text-emerald-100">دبّر يساعدك تفهم مصاريفك، تخطط لالتزاماتك، وتوصل لأهدافك بخطوات بسيطة وبدون تعقيد.</p>
            <div className="mt-8 flex flex-wrap gap-3"><Link to="/register" className="rounded-2xl bg-white px-7 py-4 font-bold text-emerald-950 shadow-lg hover:bg-emerald-50">أنشئ حسابك</Link><Link to="/login" className="rounded-2xl border border-white/40 px-7 py-4 font-bold hover:bg-white/10">عندي حساب</Link></div>
          </div>
          <div className="rounded-[2rem] border border-white/20 bg-white/10 p-5 shadow-2xl backdrop-blur sm:p-8" aria-label="معاينة توضيحية للوحة دبّر">
            <div className="rounded-3xl bg-white p-6 text-ink-900"><p className="text-sm text-ink-500">نظرة على شهر مرتب</p><h2 className="mt-2 text-2xl font-bold">لوحتك المالية</h2>
              <div className="mt-6 grid grid-cols-2 gap-3"><div className="rounded-2xl bg-brand-50 p-4"><p className="text-xs text-ink-500">ميزانية الشهر</p><p className="mt-2 text-xl font-bold text-brand-700">تحت السيطرة</p></div><div className="rounded-2xl bg-amber-50 p-4"><p className="text-xs text-ink-500">أهدافك</p><p className="mt-2 text-xl font-bold">خطوة بخطوة</p></div></div>
              <div className="mt-6 space-y-4">{['مصروفاتك اليومية','التزاماتك القادمة','خطة الادخار'].map((name,i)=><div key={name}><div className="mb-2 flex justify-between text-sm"><span>{name}</span><span className="text-ink-500">مثال توضيحي</span></div><div className="h-3 overflow-hidden rounded-full bg-ink-100"><div className="h-full rounded-full bg-brand-500" style={{width:`${[62,38,76][i]}%`}} /></div></div>)}</div>
            </div>
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8"><div className="mb-10 text-center"><h2 className="text-3xl font-bold">كل اللي تحتاجه عشان تدبّر أمورك</h2><p className="mt-3 text-ink-600">تجربة سهلة للجوال والكمبيوتر، ومصممة لحياتك اليومية.</p></div><div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">{features.map(f=><article key={f.title} className="rounded-3xl border border-ink-100 bg-white p-6 shadow-sm"><span className="text-3xl text-brand-700">{f.icon}</span><h3 className="mt-5 text-lg font-bold">{f.title}</h3><p className="mt-3 text-sm leading-7 text-ink-600">{f.detail}</p></article>)}</div></section>
      <section className="mx-auto mb-16 max-w-5xl rounded-3xl bg-brand-700 px-6 py-12 text-center text-white sm:px-12"><h2 className="text-3xl font-bold">ابدأ ترتّب أمورك من اليوم</h2><p className="mt-4 text-brand-100">حسابك خاص فيك، وبياناتك المالية ما تنعرض للمنافسين.</p><Link to="/register" className="mt-7 inline-block rounded-2xl bg-white px-8 py-4 font-bold text-brand-700">ابدأ مع دبّر</Link></section>
    </main>
    <footer className="border-t border-ink-100 px-5 py-7 text-center text-sm text-ink-500">دبّر — تنظيم مالي أبسط. <span className="sr-only">{ROUTER_BASENAME}</span></footer>
  </div>
}
