-- Public (anon) read access for the storefront.
--
-- The ERP's existing RLS policies only cover the `authenticated` role (ERP
-- staff). The public shop talks to PostgREST with the anon key, whose role is
-- `anon`, so with no anon policy every catalogue query returns zero rows (RLS
-- denies silently — no error). These policies grant read access to the anon
-- role, scoped to published / active rows so unpublished drafts stay hidden.
--
-- NOTE: these tables are owned by the ERP. This migration lives in the public
-- shop repo for convenience; if the ERP later manages catalogue RLS centrally,
-- move it there to avoid divergence. Policy names are unique to avoid clashing
-- with the existing `authenticated` policies.

-- Categories: only published.
CREATE POLICY "Public can view published categories"
  ON public.product_categories FOR SELECT TO anon
  USING (is_published = true);

-- Products: only published.
CREATE POLICY "Public can view published products"
  ON public.products FOR SELECT TO anon
  USING (is_published = true);

-- Variants: only active, and only for a published product.
CREATE POLICY "Public can view active variants of published products"
  ON public.product_variants FOR SELECT TO anon
  USING (
    is_active = true
    AND EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_variants.product_id AND p.is_published = true
    )
  );

-- Images: only for a published product. (The browser never reads storage_path;
-- signed URLs come from the webshop-public-images edge function.)
CREATE POLICY "Public can view images of published products"
  ON public.product_images FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_images.product_id AND p.is_published = true
    )
  );
