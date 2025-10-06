// auth.js - UPDATED WITH ACCOUNT DELETION AND NGO VERIFICATION
const SUPABASE_URL = "https://ceorbsqwabgioxfcrqvv.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNlb3Jic3F3YWJnaW94ZmNycXZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzNDQ3OTMsImV4cCI6MjA3NDkyMDc5M30.rcmIGUIg1jeTXu0n6lc5Kpz3BLwmIzm2aOW4V6alOlU";

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

class AuthHelper {
    constructor() {
        this.supabase = supabase;
        this.isProcessingLogin = false;
    }

    async checkEmailExists(email) {
        try {
            console.log('🔍 Checking if email exists:', email);
            
            // Check donor_profiles
            const { data: donorData, error: donorError } = await this.supabase
                .from('donor_profiles')
                .select('email')
                .eq('email', email)
                .maybeSingle();

            if (donorError) {
                console.error('❌ Error checking donor profiles:', donorError);
            }

            if (donorData) {
                console.log('❌ Email exists in donor profiles:', email);
                return true;
            }

            // Check ngo_profiles
            const { data: ngoData, error: ngoError } = await this.supabase
                .from('ngo_profiles')
                .select('contact_email')
                .eq('contact_email', email)
                .maybeSingle();

            if (ngoError) {
                console.error('❌ Error checking NGO profiles:', ngoError);
            }

            if (ngoData) {
                console.log('❌ Email exists in NGO profiles:', email);
                return true;
            }

            console.log('✅ Email is available:', email);
            return false;

        } catch (error) {
            console.error('💥 Error checking email existence:', error);
            return false;
        }
    }

    async checkPhoneExists(phoneNumber, userType = 'donor') {
        try {
            console.log('🔍 Checking if phone number exists:', phoneNumber);
            
            if (!phoneNumber) {
                return false;
            }

            const cleanPhone = phoneNumber.replace(/\D/g, '');

            if (userType === 'donor' || userType === 'both') {
                const { data: donorData, error: donorError } = await this.supabase
                    .from('donor_profiles')
                    .select('phone_number')
                    .eq('phone_number', cleanPhone)
                    .maybeSingle();

                if (donorError) {
                    console.error('❌ Error checking donor phone numbers:', donorError);
                }

                if (donorData) {
                    console.log('❌ Phone number exists in donor profiles:', cleanPhone);
                    return true;
                }
            }

            if (userType === 'ngo' || userType === 'both') {
                const { data: ngoData, error: ngoError } = await this.supabase
                    .from('ngo_profiles')
                    .select('contact_phone')
                    .eq('contact_phone', cleanPhone)
                    .maybeSingle();

                if (ngoError) {
                    console.error('❌ Error checking NGO phone numbers:', ngoError);
                }

                if (ngoData) {
                    console.log('❌ Phone number exists in NGO profiles:', cleanPhone);
                    return true;
                }
            }

            console.log('✅ Phone number is available:', cleanPhone);
            return false;

        } catch (error) {
            console.error('💥 Error checking phone number:', error);
            return false;
        }
    }

    async loginUser(email, password) {
        try {
            if (this.isProcessingLogin) {
                console.log('⏳ Login already in progress, skipping...');
                return;
            }

            this.isProcessingLogin = true;
            console.log('🔐 Attempting login for:', email);
            
            const { data, error } = await this.supabase.auth.signInWithPassword({ 
                email: email, 
                password: password 
            });
            
            if (error) {
                console.error('❌ Login error:', error);
                this.isProcessingLogin = false;
                throw error;
            }

            console.log('✅ Login successful, user ID:', data.user.id);

            // Check NGO profile first
            const { data: ngoProfile, error: ngoError } = await this.supabase
                .from('ngo_profiles')
                .select('id, status, ngo_name')
                .eq('id', data.user.id)
                .maybeSingle();

            console.log('🏢 NGO profile check:', { ngoProfile, ngoError });

            // If user is an NGO, check status and redirect accordingly
            if (ngoProfile) {
                console.log('🏢 User is an NGO with status:', ngoProfile.status);
                
                if (ngoProfile.status === 'pending') {
                    console.log('⏳ NGO account pending approval');
                    this.isProcessingLogin = false;
                    window.location.href = 'ngo-pending.html';
                    return;
                } else if (ngoProfile.status === 'rejected') {
                    console.log('❌ NGO account rejected');
                    this.isProcessingLogin = false;
                    window.location.href = 'ngo-rejected.html';
                    return;
                } else if (ngoProfile.status === 'approved') {
                    console.log('✅ NGO account approved, redirecting to dashboard');
                    this.isProcessingLogin = false;
                    window.location.href = 'ngodashboard.html';
                    return;
                }
            }

            // If not NGO, check if donor
            const { data: donorProfile, error: donorError } = await this.supabase
                .from('donor_profiles')
                .select('id')
                .eq('id', data.user.id)
                .maybeSingle();

            console.log('🎯 Donor profile check:', { donorProfile, donorError });

            if (donorProfile) {
                console.log('🎯 User is a donor, redirecting to donor dashboard');
                this.isProcessingLogin = false;
                window.location.href = 'dashboard.html';
                return;
            }

            // If no profile found
            console.log('❓ User has no profile, redirecting to role selection');
            this.isProcessingLogin = false;
            window.location.href = 'DonorOrNgo.html';

        } catch (error) {
            console.error('💥 Login failed:', error);
            this.isProcessingLogin = false;
            
            // Handle case where no profile exists
            if (error.code === 'PGRST116') {
                console.log('❓ User has no profile, redirecting to role selection');
                window.location.href = 'DonorOrNgo.html';
                return;
            }
            
            throw error;
        }
    }

    async signupDonor(userData) {
        try {
            console.log('👤 Starting donor registration...', userData.email);

            // Check if email already exists
            const emailExists = await this.checkEmailExists(userData.email);
            if (emailExists) {
                throw new Error('This email address is already registered. Please use a different email or try logging in.');
            }

            // Check if phone number already exists (if provided)
            if (userData.phoneNumber && userData.phoneNumber.trim() !== '') {
                const phoneExists = await this.checkPhoneExists(userData.phoneNumber, 'donor');
                if (phoneExists) {
                    throw new Error('This phone number is already registered. Please use a different phone number.');
                }
            }

            // Create auth user
            const { data: authData, error: authError } = await this.supabase.auth.signUp({ 
                email: userData.email, 
                password: userData.password 
            });
            
            if (authError) {
                if (authError.message.includes('already registered')) {
                    throw new Error('This email address is already registered. Please use a different email or try logging in.');
                }
                throw authError;
            }
            
            if (!authData.user) throw new Error('User creation failed');

            console.log('✅ Auth user created:', authData.user.id);

            // Create donor profile
            const { error: profileError } = await this.supabase.from('donor_profiles').insert([{
                id: authData.user.id,
                first_name: userData.firstName,
                last_name: userData.lastName,
                email: userData.email,
                phone_number: userData.phoneNumber ? userData.phoneNumber.replace(/\D/g, '') : null,
                age: userData.age,
                city: userData.city,
                state: userData.state,
                pin_code: userData.pinCode,
                address: userData.address
            }]);

            if (profileError) throw profileError;

            console.log('✅ Donor profile created');

            // Auto sign in
            const { error: signInError } = await this.supabase.auth.signInWithPassword({
                email: userData.email,
                password: userData.password
            });

            if (signInError) {
                console.warn('⚠️ Auto sign-in failed, but registration successful');
                window.location.href = 'LoginSignUp.html?message=Registration successful! Please sign in.';
                return;
            }

            console.log('🎉 Donor registration complete, redirecting...');
            window.location.href = 'dashboard.html';

        } catch (error) {
            console.error('💥 Donor registration failed:', error);
            throw error;
        }
    }

    async signupNGO(ngoData, files = null) {
        try {
            console.log('🏢 Starting NGO registration...', ngoData.email);

            // Check if email already exists
            const emailExists = await this.checkEmailExists(ngoData.email);
            if (emailExists) {
                throw new Error('This email address is already registered. Please use a different email or try logging in.');
            }

            // Check if phone number already exists
            const phoneExists = await this.checkPhoneExists(ngoData.contactNumber, 'ngo');
            if (phoneExists) {
                throw new Error('This phone number is already registered. Please use a different phone number.');
            }

            // Verify Darpan ID if provided
            if (ngoData.darpanId) {
                const isDarpanApproved = await this.verifyDarpanId(ngoData.darpanId);
                if (!isDarpanApproved) {
                    throw new Error('The provided Darpan ID is not in our approved list. Please check the ID and try again.');
                }
            }

            // Create auth user
            const { data: authData, error: authError } = await this.supabase.auth.signUp({ 
                email: ngoData.email, 
                password: ngoData.password 
            });
            
            if (authError) {
                if (authError.message.includes('already registered')) {
                    throw new Error('This email address is already registered. Please use a different email or try logging in.');
                }
                throw authError;
            }
            
            if (!authData.user) throw new Error('User creation failed');

            console.log('✅ Auth user created:', authData.user.id);

            // Upload documents if provided
            let documentUrls = {};
            if (files) {
                documentUrls = await this.uploadNgoDocuments(authData.user.id, files);
            }

            // Create NGO profile with pending status
            const { error: profileError } = await this.supabase.from('ngo_profiles').insert([{
                id: authData.user.id,
                ngo_name: ngoData.ngoName,
                org_type: ngoData.orgType,
                registration_number: ngoData.regNumber,
                registration_date: ngoData.regDate,
                address: ngoData.address,
                city: ngoData.city,
                state: ngoData.state,
                pin_code: ngoData.pincode,
                contact_phone: ngoData.contactNumber ? ngoData.contactNumber.replace(/\D/g, '') : null,
                contact_email: ngoData.email,
                website_url: ngoData.website,
                darpan_id: ngoData.darpanId,
                status: 'pending' // Default status is pending
            }]);

            if (profileError) {
                console.error('❌ NGO profile creation error:', profileError);
                throw profileError;
            }

            console.log('✅ NGO profile created with pending status');

            // Store document references
            if (Object.keys(documentUrls).length > 0) {
                await this.storeDocumentReferences(authData.user.id, documentUrls);
            }

            // Auto sign in with delay
            setTimeout(async () => {
                try {
                    const { error: signInError } = await this.supabase.auth.signInWithPassword({
                        email: ngoData.email,
                        password: ngoData.password
                    });

                    if (signInError) {
                        console.warn('⚠️ Auto sign-in failed, but registration successful');
                        window.location.href = 'LoginSignUp.html?message=Registration successful! Please sign in.';
                        return;
                    }

                    console.log('🎉 NGO registration complete, redirecting to pending page...');
                    window.location.href = 'ngo-pending.html';
                    
                } catch (signInError) {
                    console.error('💥 Auto sign-in failed:', signInError);
                    window.location.href = 'LoginSignUp.html?message=Registration successful! Please sign in.';
                }
            }, 1000);

        } catch (error) {
            console.error('💥 NGO registration failed:', error);
            throw error;
        }
    }

    async verifyDarpanId(darpanId) {
        try {
            const { data, error } = await this.supabase
                .from('approved_darpan_ids')
                .select('id')
                .eq('darpan_id', darpanId)
                .eq('is_active', true)
                .maybeSingle();

            if (error) {
                console.error('Error verifying Darpan ID:', error);
                return false;
            }

            return !!data;
        } catch (error) {
            console.error('Error in Darpan verification:', error);
            return false;
        }
    }

    async uploadNgoDocuments(userId, files) {
        const documentUrls = {};
        
        try {
            for (const [docType, file] of Object.entries(files)) {
                if (file) {
                    const fileExt = file.name.split('.').pop();
                    const fileName = `${userId}_${docType}_${Date.now()}.${fileExt}`;
                    const filePath = `ngo-documents/${userId}/${fileName}`;

                    const { error: uploadError } = await this.supabase.storage
                        .from('verification-docs')
                        .upload(filePath, file);

                    if (uploadError) {
                        console.error(`Error uploading ${docType}:`, uploadError);
                        continue;
                    }

                    const { data } = this.supabase.storage
                        .from('verification-docs')
                        .getPublicUrl(filePath);

                    documentUrls[docType] = {
                        file_name: fileName,
                        file_path: filePath,
                        public_url: data.publicUrl
                    };
                }
            }
        } catch (error) {
            console.error('Error uploading documents:', error);
        }

        return documentUrls;
    }

    async storeDocumentReferences(userId, documentUrls) {
        try {
            const documentRecords = Object.entries(documentUrls).map(([docType, docInfo]) => ({
                ngo_id: userId,
                document_type: docType,
                file_name: docInfo.file_name,
                file_path: docInfo.file_path
            }));

            const { error } = await this.supabase
                .from('ngo_verification_docs')
                .insert(documentRecords);

            if (error) {
                console.error('Error storing document references:', error);
            }
        } catch (error) {
            console.error('Error in storeDocumentReferences:', error);
        }
    }

    async deleteUserAccount() {
        try {
            const user = await this.getCurrentUser();
            if (!user) {
                throw new Error('No user logged in');
            }

            console.log('🗑️ Starting account deletion for user:', user.id);

            // First, check if user is donor or NGO to handle related data
            const { data: donorProfile } = await this.supabase
                .from('donor_profiles')
                .select('id')
                .eq('id', user.id)
                .maybeSingle();

            const { data: ngoProfile } = await this.supabase
                .from('ngo_profiles')
                .select('id, status')
                .eq('id', user.id)
                .maybeSingle();

            // Delete auth user (this will cascade delete related profiles due to foreign key constraints)
            const { error: deleteError } = await this.supabase.auth.admin.deleteUser(user.id);

            if (deleteError) {
                console.error('❌ Error deleting user account:', deleteError);
                throw new Error('Failed to delete account: ' + deleteError.message);
            }

            console.log('✅ Account deleted successfully');

            // Redirect to home page
            window.location.href = 'LandingPage.html?message=Account deleted successfully';

        } catch (error) {
            console.error('💥 Account deletion failed:', error);
            throw error;
        }
    }

    async deleteUserAccountWithConfirmation() {
        const confirmation = confirm(
            'Are you sure you want to delete your account? This action cannot be undone. ' +
            'All your data, including donations, requests, and profile information will be permanently deleted.'
        );

        if (!confirmation) {
            return;
        }

        const secondConfirmation = confirm(
            'FINAL WARNING: This will permanently delete your account and all associated data. ' +
            'This action cannot be reversed. Click OK to confirm deletion.'
        );

        if (!secondConfirmation) {
            return;
        }

        try {
            await this.deleteUserAccount();
        } catch (error) {
            alert('Account deletion failed: ' + error.message);
        }
    }

    async checkAuth() {
        const { data: { session } } = await this.supabase.auth.getSession();
        return session;
    }

    async getCurrentUser() {
        const { data: { user } } = await this.supabase.auth.getUser();
        return user;
    }

 async logoutUser() {
    try {
        console.log('🚪 Starting comprehensive logout process...');
        
        // Clear login state
        this.isProcessingLogin = false;
        
        // Multiple sign out attempts
        await this.supabase.auth.signOut();
        
        // Clear all browser storage
        localStorage.clear();
        sessionStorage.clear();
        
        // Clear cookies (if any)
        document.cookie.split(";").forEach(function(c) {
            document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
        });
        
        console.log('✅ Comprehensive logout completed');
        
        // Force hard redirect
        window.location.replace('LoginSignUp.html');
        
    } catch (error) {
        console.error('💥 Logout failed:', error);
        // Still redirect even if there's an error
        window.location.replace('LoginSignUp.html');
    }
}

    // Helper method to check if user is approved NGO
    async isApprovedNGO() {
        try {
            const user = await this.getCurrentUser();
            if (!user) return false;

            const { data: ngoProfile } = await this.supabase
                .from('ngo_profiles')
                .select('status')
                .eq('id', user.id)
                .maybeSingle();

            return ngoProfile && ngoProfile.status === 'approved';
        } catch (error) {
            console.error('Error checking NGO status:', error);
            return false;
        }
    }

    // Helper method to check if user is donor
    async isDonor() {
        try {
            const user = await this.getCurrentUser();
            if (!user) return false;

            const { data: donorProfile } = await this.supabase
                .from('donor_profiles')
                .select('id')
                .eq('id', user.id)
                .maybeSingle();

            return !!donorProfile;
        } catch (error) {
            console.error('Error checking donor status:', error);
            return false;
        }
    }
}

// Initialize and expose
window.authHelper = new AuthHelper();
console.log('✅ AuthHelper initialized with account deletion and NGO verification');
