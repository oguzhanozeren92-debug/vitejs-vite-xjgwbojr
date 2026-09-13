from pathlib import Path

app = Path('src/App.tsx')
text = app.read_text()
marker = "  useEffect(() => {\n    if (screen !== 'fieldDetail' || !selectedField) return;"
if 'tp:open-field-season' not in text:
    block = """  useEffect(() => {
    const handleOpenFieldSeason = (event: Event) => {
      const detail = (event as CustomEvent<{ fieldId?: string }>).detail ?? {};
      const requestedFieldId = String(detail.fieldId ?? '').trim();
      if (!requestedFieldId) return;

      const field = realFields.find(
        (item) => String(item.id) === requestedFieldId,
      );
      if (!field) return;

      openFieldDetail(field);
      setAnnualYear(String(field.season ?? new Date().getFullYear()));
      setAnnualCrop(field.crop ?? '');
      setAnnualPlantingDate('');
      setAnnualHarvestDate('');
      setAnnualNotes('');
      setHistoryMessage('');
      setAnnualFormOpen(true);
    };

    window.addEventListener(
      'tp:open-field-season',
      handleOpenFieldSeason as EventListener,
    );
    return () => {
      window.removeEventListener(
        'tp:open-field-season',
        handleOpenFieldSeason as EventListener,
      );
    };
  }, [realFields]);

"""
    if marker not in text:
        raise SystemExit('App.tsx field-detail effect marker not found')
    text = text.replace(marker, block + marker, 1)
    app.write_text(text)

hook = Path('src/features/field-detail/hooks/useFieldProductionHistory.ts')
text = hook.read_text()
old = """      resetAnnualForm();
      setAnnualFormOpen(false);
      await loadProductionHistory(selectedField);
"""
new = """      resetAnnualForm();
      setAnnualFormOpen(false);
      await loadProductionHistory(selectedField);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('tp:field-context-updated', {
            detail: {
              fieldId: String(selectedField.id),
              changedFields: ['field_seasons', 'planting_date'],
              source: 'field-season-saved',
            },
          }),
        );
      }
"""
if "source: 'field-season-saved'" not in text:
    if old not in text:
        raise SystemExit('useFieldProductionHistory season-save marker not found')
    text = text.replace(old, new, 1)
    hook.write_text(text)
