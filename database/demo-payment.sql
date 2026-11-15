-- Run in the Supabase SQL Editor. Pay now is a simulation only; no payment is processed.
alter table public.appointments
    add column if not exists payment_method text not null default 'pay_at_salon',
    add column if not exists payment_status text not null default 'Pay at salon';

alter table public.appointments
    alter column payment_method set default 'pay_at_salon',
    alter column payment_status set default 'Pay at salon';

update public.appointments
set payment_method = case when payment_method = 'cash_on_delivery' then 'pay_at_salon' else payment_method end,
    payment_status = case
        when payment_status = 'Due on arrival' then 'Pay at salon'
        when payment_status = 'Paid (Demo)' then 'Paid'
        else payment_status
    end;
