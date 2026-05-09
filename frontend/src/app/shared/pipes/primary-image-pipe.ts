import { Pipe, PipeTransform } from '@angular/core';
import { ProductImage } from '../../core/models/product.model';

@Pipe({
  name: 'primaryImage',
  standalone: true
})
export class PrimaryImagePipe implements PipeTransform {
  transform(images: ProductImage[] | undefined | null, fallback = 'https://placehold.co/600x800/e2e8f0/475569?text=Product+Image'): string {
    if (!images || !Array.isArray(images) || images.length === 0) return fallback;
    const primary = images.find(img => img.is_primary);
    return primary?.image ?? images[0]?.image ?? fallback;
  }
}
