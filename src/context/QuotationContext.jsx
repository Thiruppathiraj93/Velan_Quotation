
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { addDays, todayDisplay } from '../utils/dateUtils';
import {
  itemAmount,
  subTotal,
  gst,
  total,
} from '../utils/calculations';
import {
  saveDraft,
  loadDraft,
  clearDraft,
} from '../utils/localStorage';
import { getTemplates } from '../utils/templateLoader';
import { getProductConfig } from '../data/products';
import { deriveCharge } from '../utils/roomCharges';

const QuotationContext = createContext(null);

function findTemplateById(product, id) {
  try {
    return getTemplates(product).find((t) => t.id === id) || null;
  } catch {
    return null;
  }
}

export function QuotationProvider({ children }) {
  const [product, setProduct] = useState(() => {
    try {
      return loadDraft()?.product || '';
    } catch {
      return '';
    }
  });

  const [template, setTemplate] = useState(() => {
    try {
      const d = loadDraft();
      if (d?.product && d?.templateId) {
        return findTemplateById(d.product, d.templateId);
      }
    } catch {}
    return null;
  });

  const [selectedSpecification, setSelectedSpecification] = useState(() => {
    try {
      return loadDraft()?.selectedSpecification || '';
    } catch {
      return '';
    }
  });

  const [form, setForm] = useState(() => {
    try {
      const draft = loadDraft()?.form;
      return {
        ...(draft || {}),
        quoteDate: draft?.quoteDate || todayDisplay(),
      };
    } catch {
      return { quoteDate: todayDisplay() };
    }
  });

  const applyTemplate = (t) => {
    setTemplate(t);

    // Room / Toilet quotations use Rate x Nos (no tank capacity inputs).
    // Transportation / crane charges are editable amount fields prefilled
    // from the Excel notes (Toilet notes carry no amount, so they start
    // empty and the original "at client scope" wording is kept).
    if (t.product === 'Room' || t.product === 'Toilet') {
      setForm({
        billTo: t.billTo,
        shipTo: t.shipTo,
        quoteNo: t.quoteNo,
        quoteGivenBy: t.quoteGivenBy || '',
        quoteDate: todayDisplay(),
        customerNumber: t.customerNumber,
        rate: t.rate,
        nos: t.nos,
        transportation:
          deriveCharge(t, ['transportation', 'transport charges'])?.def ?? '',
        crane: deriveCharge(t, 'crane')?.def ?? '',
      });
      return;
    }

    setForm({
      billTo: t.billTo,
      shipTo: t.shipTo,
      quoteNo: t.quoteNo,
      quoteGivenBy: t.quoteGivenBy,
      quoteDate: todayDisplay(),
      customerNumber: t.customerNumber,
      tankCapacity: t.qty,
      capacityText: t.capacityText,
      qty: t.qty,
      rate: t.rate,
      nos: t.nos,
      transportation: t.transport.isClientScope
        ? ''
        : t.transport.number,
      transportationMode: t.transport.isClientScope
        ? 'client'
        : 'direct',
      crane: t.crane.isClientScope ? '' : t.crane.number,
      craneMode: t.crane.isClientScope ? 'client' : 'direct',
      coreCutCharges: false,
      coreCutChargeValue: '',
      coreCutChargeMode: 'direct',
    });
  };

  const update = (patch) => {
    setForm((f) => ({ ...f, ...patch }));
  };

  const productConfig = getProductConfig(product);

  // Room: Amount = Rate x Nos. Tanks: Amount = Qty x Rate x Nos.
  const amount =
    productConfig?.calcMode === 'rateNos'
      ? (Number(form.rate) || 0) * (Number(form.nos) || 0)
      : itemAmount(form.qty, form.rate, form.nos);
  const sub = subTotal([amount]);
  const gstAmt = gst(sub);
  const tot = total(sub, gstAmt);

  // Water/Septic Tank: expiry = quote date + 10 days. Room: + 20 days.
  const expiryDate = addDays(form.quoteDate, productConfig?.expiryDays ?? 10);

  const capacityDisplayText = useMemo(() => {
    if (!template) return form.capacityText || '';

    // Room templates have no tank capacity token/line.
    if (!template.capToken) return form.capacityText || '';

    const q = Number(form.qty);
    const newCap = template.capToken.includes(',')
      ? q
        ? q.toLocaleString('en-US')
        : ''
      : String(form.qty);

    return (form.capacityText || '').replace(template.capToken, newCap);
  }, [template, form.capacityText, form.qty]);

  const transportLine = useMemo(() => {
    if (!template || !template.transport) return '';

    if (form.transportationMode === 'client') {
      return template.transport.isClientScope
        ? template.transport.original
        : 'Client Scope.';
    }

    const value =
      form.transportation ||
      (template.transport.isClientScope
        ? ''
        : template.transport.number);

    if (!value) {
      return (
        template.transport.original ||
        template.transportPart ||
        'Client Scope.'
      );
    }

    if (template.transport.isClientScope) {
      return `${value}/-- Pay to direct party.`;
    }

    return `${template.transport.prefix}${value}${template.transport.suffix}`;
  }, [template, form.transportation, form.transportationMode]);

  const craneLine = useMemo(() => {
    if (!template || !template.crane) return '';

    if (form.craneMode === 'client') {
      return template.crane.isClientScope
        ? template.crane.original
        : 'Client Scope.';
    }

    const value =
      form.crane ||
      (template.crane.isClientScope ? '' : template.crane.number);

    if (!value) {
      return (
        template.crane.original ||
        template.cranePart ||
        'Client Scope.'
      );
    }

    if (template.crane.isClientScope) {
      return `${value}/-- Pay to direct party.`;
    }

    return `${template.crane.prefix}${value}${template.crane.suffix}`;
  }, [template, form.crane, form.craneMode]);

  const setTransportation = (v) => update({ transportation: v });
  const setCrane = (v) => update({ crane: v });
  const setRate = (v) => update({ rate: v });

  const setTankCapacity = (v) => {
    update({ tankCapacity: v, qty: v });
  };

  const draftData = () => ({
    product,
    templateId: template?.id,
    form,
    selectedSpecification,
  });

  const save = () => saveDraft(draftData());

  const clear = () => {
    clearDraft();
    setForm({ quoteDate: todayDisplay() });
    setTemplate(null);
    setProduct('');
    setSelectedSpecification('');
  };

  useEffect(() => {
    if (product && template && form.quoteNo !== undefined) {
      saveDraft(draftData());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, template, product, selectedSpecification]);

  const restore = () => {
    const d = loadDraft();

    if (!d || !d.product || !d.templateId) return;

    const t = findTemplateById(d.product, d.templateId);

    setProduct(d.product);
    setTemplate(t);
    setSelectedSpecification(d.selectedSpecification || '');
    setForm({
      ...(d.form || {}),
      quoteDate: d.form?.quoteDate || todayDisplay(),
    });
  };

  return (
    <QuotationContext.Provider
      value={{
        product,
        setProduct,
        template,
        applyTemplate,
        form,
        update,
        amount,
        sub,
        gstAmt,
        tot,
        expiryDate,
        capacityDisplayText,
        transportLine,
        craneLine,
        setTransportation,
        setCrane,
        setRate,
        setTankCapacity,
        selectedSpecification,
        setSelectedSpecification,
        clearDraft: clear,
        loadDraft,
        saveDraft: save,
        restoreDraft: restore,
      }}
    >
      {children}
    </QuotationContext.Provider>
  );
}

export function useQuotation() {
  return useContext(QuotationContext);
}
