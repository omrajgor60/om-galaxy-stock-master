-- Create app_role enum for secure role management
CREATE TYPE public.app_role AS ENUM ('admin', 'staff');

-- Create profiles table for user information
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create user_roles table (SEPARATE from profiles for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'staff',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE (user_id, role)
);

-- Create products table with low stock threshold
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  model TEXT NOT NULL,
  brand TEXT,
  ram TEXT,
  storage TEXT,
  color TEXT,
  price DECIMAL(10, 2) NOT NULL DEFAULT 0,
  low_stock_threshold INTEGER NOT NULL DEFAULT 5,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create stock_logs table for scanned items with IMEIs
CREATE TABLE public.stock_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  imei TEXT NOT NULL UNIQUE,
  scanned_by UUID REFERENCES auth.users(id) NOT NULL,
  status TEXT NOT NULL DEFAULT 'in_stock' CHECK (status IN ('in_stock', 'sold', 'returned', 'damaged')),
  scanned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  sold_at TIMESTAMP WITH TIME ZONE,
  notes TEXT
);

-- Create customers table
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  email TEXT,
  address TEXT,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  total_spent DECIMAL(12, 2) DEFAULT 0,
  purchase_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create sales table
CREATE TABLE public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_log_id UUID REFERENCES public.stock_logs(id) NOT NULL,
  customer_id UUID REFERENCES public.customers(id) NOT NULL,
  product_id UUID REFERENCES public.products(id) NOT NULL,
  sold_by UUID REFERENCES auth.users(id) NOT NULL,
  sale_price DECIMAL(10, 2) NOT NULL,
  discount DECIMAL(10, 2) DEFAULT 0,
  payment_method TEXT DEFAULT 'cash' CHECK (payment_method IN ('cash', 'card', 'upi', 'credit')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create time_off_requests table
CREATE TABLE public.time_off_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'seen')),
  admin_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create issue_reports table
CREATE TABLE public.issue_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('product', 'technical', 'general')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  image_url TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'resolved')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  admin_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create backups table
CREATE TABLE public.backups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  backup_type TEXT NOT NULL DEFAULT 'auto' CHECK (backup_type IN ('auto', 'manual')),
  file_path TEXT,
  file_size BIGINT,
  records_count JSONB,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed')),
  error_message TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create stock_alerts table for alert history
CREATE TABLE public.stock_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  alert_level TEXT NOT NULL CHECK (alert_level IN ('low', 'critical', 'out_of_stock')),
  stock_count INTEGER NOT NULL,
  threshold INTEGER NOT NULL,
  is_resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create notifications table for in-app alerts
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info' CHECK (type IN ('info', 'warning', 'error', 'success', 'stock_alert')),
  is_read BOOLEAN DEFAULT FALSE,
  link TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_off_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issue_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles (prevents recursive RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Create function to get user role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id LIMIT 1
$$;

-- RLS Policies for profiles
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can insert profiles" ON public.profiles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') OR auth.uid() = user_id);
CREATE POLICY "Admins can delete profiles" ON public.profiles FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for user_roles (only admins can manage)
CREATE POLICY "Users can view roles" ON public.user_roles FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "Admins can insert roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update roles" ON public.user_roles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete roles" ON public.user_roles FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for products
CREATE POLICY "All users can view products" ON public.products FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "Admins can insert products" ON public.products FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update products" ON public.products FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete products" ON public.products FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for stock_logs
CREATE POLICY "All users can view stock logs" ON public.stock_logs FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "All users can insert stock logs" ON public.stock_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = scanned_by);
CREATE POLICY "Admins can update stock logs" ON public.stock_logs FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR auth.uid() = scanned_by);
CREATE POLICY "Admins can delete stock logs" ON public.stock_logs FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for customers
CREATE POLICY "All users can view customers" ON public.customers FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "All users can insert customers" ON public.customers FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Admins can update customers" ON public.customers FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR auth.uid() = created_by);
CREATE POLICY "Admins can delete customers" ON public.customers FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for sales
CREATE POLICY "All users can view sales" ON public.sales FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "All users can insert sales" ON public.sales FOR INSERT TO authenticated WITH CHECK (auth.uid() = sold_by);
CREATE POLICY "Admins can update sales" ON public.sales FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete sales" ON public.sales FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for time_off_requests
CREATE POLICY "Users can view own requests" ON public.time_off_requests FOR SELECT TO authenticated 
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can insert own requests" ON public.time_off_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can update requests" ON public.time_off_requests FOR UPDATE TO authenticated 
  USING (public.has_role(auth.uid(), 'admin') OR auth.uid() = user_id);
CREATE POLICY "Admins can delete requests" ON public.time_off_requests FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for issue_reports
CREATE POLICY "Users can view own reports or admins all" ON public.issue_reports FOR SELECT TO authenticated 
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can insert reports" ON public.issue_reports FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can update reports" ON public.issue_reports FOR UPDATE TO authenticated 
  USING (public.has_role(auth.uid(), 'admin') OR auth.uid() = user_id);
CREATE POLICY "Admins can delete reports" ON public.issue_reports FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for backups (admin only)
CREATE POLICY "Admins can view backups" ON public.backups FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert backups" ON public.backups FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for stock_alerts (admin only)
CREATE POLICY "Admins can view stock alerts" ON public.stock_alerts FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "System can insert stock alerts" ON public.stock_alerts FOR INSERT TO authenticated WITH CHECK (TRUE);
CREATE POLICY "Admins can update stock alerts" ON public.stock_alerts FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for notifications
CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "System can insert notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (TRUE);
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own notifications" ON public.notifications FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Create function to handle new user creation (auto-create profile)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
    NEW.raw_user_meta_data ->> 'phone'
  );
  RETURN NEW;
END;
$$;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_time_off_requests_updated_at BEFORE UPDATE ON public.time_off_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_issue_reports_updated_at BEFORE UPDATE ON public.issue_reports FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to check stock levels and create alerts
CREATE OR REPLACE FUNCTION public.check_stock_level()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product_id UUID;
  v_stock_count INTEGER;
  v_threshold INTEGER;
  v_alert_level TEXT;
  v_admin_users UUID[];
BEGIN
  -- Get the product ID
  IF TG_OP = 'UPDATE' AND NEW.status = 'sold' AND OLD.status != 'sold' THEN
    v_product_id := NEW.product_id;
  ELSE
    RETURN NEW;
  END IF;

  -- Count current in-stock items
  SELECT COUNT(*) INTO v_stock_count
  FROM public.stock_logs
  WHERE product_id = v_product_id AND status = 'in_stock';

  -- Get threshold
  SELECT low_stock_threshold INTO v_threshold
  FROM public.products WHERE id = v_product_id;

  -- Determine alert level
  IF v_stock_count = 0 THEN
    v_alert_level := 'out_of_stock';
  ELSIF v_stock_count <= 2 THEN
    v_alert_level := 'critical';
  ELSIF v_stock_count <= v_threshold THEN
    v_alert_level := 'low';
  ELSE
    RETURN NEW;
  END IF;

  -- Create stock alert
  INSERT INTO public.stock_alerts (product_id, alert_level, stock_count, threshold)
  VALUES (v_product_id, v_alert_level, v_stock_count, v_threshold);

  -- Get all admin users
  SELECT ARRAY_AGG(user_id) INTO v_admin_users
  FROM public.user_roles WHERE role = 'admin';

  -- Create notifications for admins
  IF v_admin_users IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, message, type, link)
    SELECT 
      unnest(v_admin_users),
      CASE v_alert_level
        WHEN 'out_of_stock' THEN 'Out of Stock!'
        WHEN 'critical' THEN 'Critical Stock Level'
        ELSE 'Low Stock Warning'
      END,
      (SELECT name || ' (' || COALESCE(color, 'Default') || ') - ' || v_stock_count || ' remaining'
       FROM public.products WHERE id = v_product_id),
      'stock_alert',
      '/inventory';
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger for stock level checking
CREATE TRIGGER check_stock_on_sale
  AFTER UPDATE ON public.stock_logs
  FOR EACH ROW EXECUTE FUNCTION public.check_stock_level();

-- Create function to update customer stats after sale
CREATE OR REPLACE FUNCTION public.update_customer_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.customers
  SET 
    total_spent = total_spent + NEW.sale_price - COALESCE(NEW.discount, 0),
    purchase_count = purchase_count + 1,
    updated_at = NOW()
  WHERE id = NEW.customer_id;
  RETURN NEW;
END;
$$;

-- Create trigger for customer stats
CREATE TRIGGER update_customer_on_sale
  AFTER INSERT ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.update_customer_stats();

-- Enable realtime for key tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.stock_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sales;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.stock_alerts;