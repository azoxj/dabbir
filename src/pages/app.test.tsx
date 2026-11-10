import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createDemoAuth } from '@/services/auth/demoAuth'
import { renderApp } from '@/test/renderApp'

describe('routing & auth', () => {
  it('redirects signed-out users to the login page', async () => {
    renderApp('/budget')
    expect(await screen.findByRole('heading', { name: 'تسجيل الدخول' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Google/ })).not.toBeInTheDocument() // لا نعرض مزوّدًا غير مفعّل
  })

  it('shows Arabic validation errors on login', async () => {
    const user = userEvent.setup()
    renderApp('/login')
    await user.click(await screen.findByRole('button', { name: 'دخول' }))
    expect(await screen.findByText('اكتب بريدك الإلكتروني.')).toBeInTheDocument()
    await user.type(screen.getByLabelText('البريد الإلكتروني'), 'a@b.co')
    await user.type(screen.getByLabelText('كلمة المرور'), 'wrong123')
    await user.click(screen.getByRole('button', { name: 'دخول' }))
    expect(await screen.findByText('البريد أو كلمة المرور غير صحيحة.')).toBeInTheDocument()
  })

  it('register validates, then lands on the dashboard «وش أسوي اليوم؟»', async () => {
    const user = userEvent.setup()
    renderApp('/register')
    await user.type(await screen.findByLabelText('البريد الإلكتروني'), 'new@user.sa')
    await user.type(screen.getByLabelText('كلمة المرور'), 'abc')
    await user.type(screen.getByLabelText('تأكيد كلمة المرور'), 'abd')
    await user.click(screen.getByRole('button', { name: 'إنشاء الحساب' }))
    expect(await screen.findByText(/8 أحرف على الأقل/)).toBeInTheDocument()
    expect(screen.getByText('كلمتا المرور غير متطابقتين.')).toBeInTheDocument()

    await user.clear(screen.getByLabelText('كلمة المرور'))
    await user.type(screen.getByLabelText('كلمة المرور'), 'secret123')
    await user.clear(screen.getByLabelText('تأكيد كلمة المرور'))
    await user.type(screen.getByLabelText('تأكيد كلمة المرور'), 'secret123')
    await user.click(screen.getByRole('button', { name: 'إنشاء الحساب' }))

    expect(await screen.findByRole('heading', { name: 'وش أسوي اليوم؟' })).toBeInTheDocument()
    const plan = await screen.findByTestId('today-plan')
    expect(within(plan).getByText('أدخل دخلك الشهري')).toBeInTheDocument()
    expect(within(plan).getByText('سجّل مصاريف اليوم')).toBeInTheDocument()
  })

  it('forgot password → reset password → back in the app', async () => {
    const user = userEvent.setup()
    const { service } = renderApp('/forgot-password')
    await service.signUp('r@x.sa', 'oldpass12', '')
    await service.signOut()
    await user.type(await screen.findByLabelText('البريد الإلكتروني'), 'r@x.sa')
    await user.click(screen.getByRole('button', { name: 'إرسال رابط الاستعادة' }))
    expect(await screen.findByRole('heading', { name: 'كلمة مرور جديدة' })).toBeInTheDocument()
    await user.type(screen.getByLabelText('كلمة المرور الجديدة'), 'newpass12')
    await user.type(screen.getByLabelText('تأكيد كلمة المرور'), 'newpass12')
    await user.click(screen.getByRole('button', { name: 'حفظ كلمة المرور' }))
    expect(await screen.findByRole('heading', { name: 'وش أسوي اليوم؟' })).toBeInTheDocument()
  })

  it('reset page without a session shows an invalid-link message', async () => {
    renderApp('/reset-password')
    expect(await screen.findByRole('heading', { name: 'الرابط غير صالح' })).toBeInTheDocument()
  })
})

describe('features (guest demo data)', () => {
  async function asGuest() {
    const r = renderApp('/login')
    await r.service.signInAsGuest()
    return r
  }

  it('dashboard shows prioritized items from seed data', async () => {
    await asGuest()
    const plan = await screen.findByTestId('today-plan')
    expect(within(plan).getByText('متأخر: فاتورة الجوال')).toBeInTheDocument()
    expect(within(plan).getByText('اليوم: موعد الأسنان')).toBeInTheDocument()
    expect(within(plan).getByText('قريب: قسط السيارة')).toBeInTheDocument()
  })

  it('budget: add an expense with Arabic digits, and reject invalid input', async () => {
    const user = userEvent.setup()
    await asGuest()
    await user.click(await screen.findByRole('link', { name: /الميزانية/ }))
    const amount = await screen.findByLabelText('المبلغ (ر.س)')
    await user.click(screen.getByRole('button', { name: 'إضافة المصروف' }))
    expect(await screen.findByText(/اكتب مبلغًا صحيحًا/)).toBeInTheDocument()
    await user.type(amount, '٤٥٫٥')
    await user.type(screen.getByLabelText('ملاحظة (اختياري)'), 'قهوة مختصة')
    await user.click(screen.getByRole('button', { name: 'إضافة المصروف' }))
    const list = await screen.findByTestId('expense-list')
    await waitFor(() => expect(within(list).getByText('قهوة مختصة')).toBeInTheDocument())
    expect(within(list).getByText(/45\.5/)).toBeInTheDocument()
  })

  it('commitments: add, complete a one-off, recurring moves forward', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    await asGuest()
    await user.click(await screen.findByRole('link', { name: /الالتزامات/ }))
    await user.click(await screen.findByRole('button', { name: '+ إضافة التزام أو موعد' }))
    await user.type(screen.getByLabelText('الاسم'), 'تجديد الإقامة')
    await user.click(screen.getByRole('button', { name: 'حفظ' }))
    const list = await screen.findByTestId('commitment-list')
    await waitFor(() => expect(within(list).getByText('تجديد الإقامة')).toBeInTheDocument())

    await user.click(within(list).getByRole('button', { name: 'تم تجديد الإقامة' }))
    await waitFor(() => expect(within(screen.getByTestId('commitment-list')).queryByText('تجديد الإقامة')).not.toBeInTheDocument())

    // متكرر شهري: يبقى في القائمة المفتوحة بتاريخ جديد
    await user.click(within(screen.getByTestId('commitment-list')).getByRole('button', { name: 'تم فاتورة الجوال' }))
    expect(await screen.findByText('تم — انتقل للموعد القادم ✓ وسُجّل كمصروف')).toBeInTheDocument()
    expect(within(screen.getByTestId('commitment-list')).getByText('فاتورة الجوال')).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'المنجزة' }))
    expect(await screen.findByText('تجديد الإقامة')).toBeInTheDocument()
  })

  it('goals: create a goal and deposit into it', async () => {
    const user = userEvent.setup()
    await asGuest()
    await user.click(await screen.findByRole('link', { name: /الأهداف/ }))
    await user.click(await screen.findByRole('button', { name: '+ هدف ادخار جديد' }))
    await user.type(screen.getByLabelText('اسم الهدف'), 'لابتوب')
    await user.type(screen.getByLabelText('المبلغ المستهدف'), '5000')
    await user.click(screen.getByRole('button', { name: 'حفظ الهدف' }))
    const card = await screen.findByRole('region', { name: 'هدف لابتوب' })
    await user.type(within(card).getByLabelText('المبلغ'), '1250')
    await user.click(within(card).getByRole('button', { name: 'إيداع' }))
    await waitFor(() => expect(within(screen.getByRole('region', { name: 'هدف لابتوب' })).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '25'))
  })

  it('sign out returns to login', async () => {
    const user = userEvent.setup()
    await asGuest()
    await user.click(await screen.findByRole('link', { name: /حسابي/ }))
    await user.click(await screen.findByRole('button', { name: 'تسجيل الخروج' }))
    expect(await screen.findByRole('heading', { name: 'تسجيل الدخول' })).toBeInTheDocument()
  })
})

describe('profile & settings', () => {
  it('edits the display name and shows it on the dashboard', async () => {
    const user = userEvent.setup()
    const { service } = renderApp('/settings')
    await service.signUp('p@x.sa', 'pass1234', 'قديم')
    const name = await screen.findByLabelText('الاسم')
    await user.clear(name)
    await user.type(name, 'عبدالله')
    await user.click(screen.getByRole('button', { name: 'حفظ' }))
    expect(await screen.findByText('تم حفظ الاسم ✓')).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: /اليوم/ }))
    expect(await screen.findByText(/عبدالله/)).toBeInTheDocument()
  })

  it('«مسح جميع بياناتي» clears the guest data after confirmation', async () => {
    const user = userEvent.setup()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)
    const { service } = renderApp('/settings')
    await service.signInAsGuest()
    const btn = await screen.findByRole('button', { name: 'مسح جميع بياناتي' })
    await user.click(btn) // إلغاء
    await user.click(btn) // تأكيد
    expect(await screen.findByText('تم مسح بياناتك')).toBeInTheDocument()
    expect(confirm).toHaveBeenCalledTimes(2)
    await user.click(screen.getByRole('link', { name: /الالتزامات/ }))
    expect(await screen.findByText('ما عندك التزامات قادمة')).toBeInTheDocument()
  })
})

describe('commitment → expense', () => {
  it('completing a commitment with an amount can log it as an expense', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { service } = renderApp('/commitments')
    await service.signInAsGuest()
    await user.click(within(await screen.findByTestId('commitment-list')).getByRole('button', { name: 'تم قسط السيارة' }))
    await screen.findByText(/وسُجّل كمصروف/)
    await user.click(screen.getByRole('link', { name: /الميزانية/ }))
    const list = await screen.findByTestId('expense-list')
    expect(within(list).getByText('قسط السيارة')).toBeInTheDocument()
  })
})

describe('redirects', () => {
  async function login(user: ReturnType<typeof userEvent.setup>) {
    await user.type(await screen.findByLabelText('البريد الإلكتروني'), 'd@x.sa')
    await user.type(screen.getByLabelText('كلمة المرور'), 'pass1234')
    await user.click(screen.getByRole('button', { name: 'دخول' }))
  }

  it('deep link while signed out returns to the requested page after login', async () => {
    const pre = createDemoAuth()
    await pre.signUp('d@x.sa', 'pass1234', '')
    await pre.signOut()
    const user = userEvent.setup()
    renderApp('/goals')
    await screen.findByRole('heading', { name: 'تسجيل الدخول' })
    await login(user)
    expect(await screen.findByRole('heading', { name: 'أهداف الادخار' })).toBeInTheDocument()
  })

  it('after an explicit sign-out, next login goes to the dashboard', async () => {
    const user = userEvent.setup()
    const { service } = renderApp('/settings')
    await service.signUp('d@x.sa', 'pass1234', '')
    await user.click(await screen.findByRole('button', { name: 'تسجيل الخروج' }))
    await screen.findByRole('heading', { name: 'تسجيل الدخول' })
    await login(user)
    expect(await screen.findByRole('heading', { name: 'وش أسوي اليوم؟' })).toBeInTheDocument()
  })
})
