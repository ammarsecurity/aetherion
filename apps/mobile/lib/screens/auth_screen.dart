import 'package:flutter/material.dart';

import '../api_service.dart';
import '../socket_service.dart';
import '../theme.dart';

class AuthScreen extends StatefulWidget {
  const AuthScreen({super.key});

  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  final _api = apiService;
  final _username = TextEditingController();
  final _password = TextEditingController();
  final _displayName = TextEditingController();

  bool _registerMode = false;
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _username.dispose();
    _password.dispose();
    _displayName.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      if (_registerMode) {
        await _api.register(
          _username.text.trim(),
          _password.text,
          displayName: _displayName.text.trim().isEmpty ? null : _displayName.text.trim(),
        );
      } else {
        await _api.login(_username.text.trim(), _password.text);
      }
      socketService.reconnectWithAuth();
      if (mounted) Navigator.of(context).pop(true);
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final canSubmit = _username.text.trim().isNotEmpty && _password.text.length >= 6;

    return Scaffold(
      appBar: AppBar(title: Text(_registerMode ? 'إنشاء حساب' : 'تسجيل الدخول')),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    _registerMode ? 'إنشاء حساب' : 'تسجيل الدخول',
                    style: Theme.of(context).textTheme.headlineSmall?.copyWith(color: AetherionColors.gold),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'احفظ مجموعاتك وتقدمك عبر الأجهزة',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: AetherionColors.textMuted),
                  ),
                  const SizedBox(height: 28),
                  TextField(
                    controller: _username,
                    decoration: const InputDecoration(labelText: 'اسم المستخدم'),
                    textInputAction: TextInputAction.next,
                    onChanged: (_) => setState(() {}),
                  ),
                  if (_registerMode) ...[
                    const SizedBox(height: 12),
                    TextField(
                      controller: _displayName,
                      decoration: const InputDecoration(labelText: 'الاسم الظاهر (اختياري)'),
                      textInputAction: TextInputAction.next,
                    ),
                  ],
                  const SizedBox(height: 12),
                  TextField(
                    controller: _password,
                    obscureText: true,
                    decoration: const InputDecoration(labelText: 'كلمة المرور (6 أحرف على الأقل)'),
                    onChanged: (_) => setState(() {}),
                    onSubmitted: (_) {
                      if (canSubmit && !_loading) _submit();
                    },
                  ),
                  const SizedBox(height: 24),
                  ElevatedButton(
                    onPressed: _loading || !canSubmit ? null : _submit,
                    child: Text(_loading ? '...' : (_registerMode ? 'تسجيل' : 'دخول')),
                  ),
                  const SizedBox(height: 12),
                  TextButton(
                    onPressed: _loading
                        ? null
                        : () => setState(() {
                              _registerMode = !_registerMode;
                              _error = null;
                            }),
                    child: Text(_registerMode ? 'عندك حساب؟ ادخل' : 'ما عندك حساب؟ سجّل'),
                  ),
                  if (_error != null) ...[
                    const SizedBox(height: 12),
                    Text(_error!, style: const TextStyle(color: AetherionColors.danger), textAlign: TextAlign.center),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
