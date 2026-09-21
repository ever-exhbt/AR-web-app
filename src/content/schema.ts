export interface ValidationError {
  targetId: string;
  itemIndex?: number;
  message: string;
}

export function validateExperiences(config: unknown): { valid: boolean; errors: ValidationError[] } {
  const errors: ValidationError[] = [];

  if (!config || typeof config !== 'object') {
    errors.push({ targetId: 'root', message: 'experiences.json must be a JSON object mapping target IDs to experience configs.' });
    return { valid: false, errors };
  }

  const entries = Object.entries(config as Record<string, unknown>);

  for (const [targetId, exp] of entries) {
    // Skip template/guide/documentation entries starting with '_' or '$'
    if (targetId.startsWith('_') || targetId.startsWith('$')) {
      continue;
    }

    if (!exp || typeof exp !== 'object') {

      errors.push({ targetId, message: `Target '${targetId}' configuration must be an object.` });
      continue;
    }

    const expObj = exp as Record<string, unknown>;

    // Validate infoCard
    if (expObj.infoCard !== undefined) {
      if (typeof expObj.infoCard !== 'object' || expObj.infoCard === null) {
        errors.push({ targetId, message: `Target '${targetId}' infoCard must be an object with 'heading' and 'body'.` });
      } else {
        const card = expObj.infoCard as Record<string, unknown>;
        if (typeof card.heading !== 'string' || !card.heading) {
          errors.push({ targetId, message: `Target '${targetId}' infoCard.heading is required and must be a string.` });
        }
        if (typeof card.body !== 'string' || !card.body) {
          errors.push({ targetId, message: `Target '${targetId}' infoCard.body is required and must be a string.` });
        }
      }
    }

    // Validate items
    if (expObj.items !== undefined) {
      if (!Array.isArray(expObj.items)) {
        errors.push({ targetId, message: `Target '${targetId}' items must be an array of experience items.` });
      } else {
        expObj.items.forEach((item: unknown, idx: number) => {
          if (!item || typeof item !== 'object') {
            errors.push({ targetId, itemIndex: idx, message: `Item #${idx} on target '${targetId}' must be an object.` });
            return;
          }

          const itemObj = item as Record<string, unknown>;
          const type = itemObj.type;

          if (!['model', 'video', 'image', 'text'].includes(type as string)) {
            errors.push({
              targetId,
              itemIndex: idx,
              message: `Item #${idx} on target '${targetId}' has invalid type '${type}'. Valid types: 'model', 'video', 'image', 'text'.`
            });
            return;
          }

          // Transform validations
          if (itemObj.position !== undefined) {
            if (!Array.isArray(itemObj.position) || itemObj.position.length !== 3 || !itemObj.position.every(n => typeof n === 'number')) {
              errors.push({
                targetId,
                itemIndex: idx,
                message: `Item #${idx} (${type}) on target '${targetId}' position must be a 3-element numeric array [x, y, z].`
              });
            }
          }

          if (itemObj.rotation !== undefined) {
            if (!Array.isArray(itemObj.rotation) || itemObj.rotation.length !== 3 || !itemObj.rotation.every(n => typeof n === 'number')) {
              errors.push({
                targetId,
                itemIndex: idx,
                message: `Item #${idx} (${type}) on target '${targetId}' rotation must be a 3-element numeric array [x, y, z] in degrees.`
              });
            }
          }

          // Specific item type checks
          if (type === 'model') {
            if (typeof itemObj.src !== 'string' || !itemObj.src) {
              errors.push({ targetId, itemIndex: idx, message: `Model item #${idx} on target '${targetId}' must have a valid 'src' path.` });
            }
          } else if (type === 'video') {
            if (typeof itemObj.src !== 'string' || !itemObj.src) {
              errors.push({ targetId, itemIndex: idx, message: `Video item #${idx} on target '${targetId}' must have a valid 'src' path.` });
            }
          } else if (type === 'image') {
            if (typeof itemObj.src !== 'string' || !itemObj.src) {
              errors.push({ targetId, itemIndex: idx, message: `Image item #${idx} on target '${targetId}' must have a valid 'src' path.` });
            }
          } else if (type === 'text') {
            if (typeof itemObj.text !== 'string') {
              errors.push({ targetId, itemIndex: idx, message: `Text item #${idx} on target '${targetId}' must have a string 'text' property.` });
            }
          }
        });
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
