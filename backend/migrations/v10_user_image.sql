ALTER TABLE public.users
ADD COLUMN image_url text
DEFAULT 'https://api.dicebear.com/7.x/initials/svg';
