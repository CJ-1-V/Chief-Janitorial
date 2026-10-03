(function () {
    'use strict';

    var form = document.getElementById('quote-form');
    if (!form) {
        return;
    }

    var summary = document.getElementById('quote-summary');
    var submitBtn = form.querySelector('button[type="submit"]');
    var fields = [
        {
            input: document.getElementById('quote-name'),
            error: document.getElementById('quote-name-error'),
            check: function (value) {
                if (!value) {
                    return 'Please enter your name.';
                }
                if (value.length < 2) {
                    return 'Please enter your name.';
                }
                return '';
            }
        },
        {
            input: document.getElementById('quote-email'),
            error: document.getElementById('quote-email-error'),
            check: function (value) {
                if (!value) {
                    return 'Please enter your email address.';
                }
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) {
                    return 'Please enter a valid email address.';
                }
                return '';
            }
        },
        {
            input: document.getElementById('quote-phone'),
            error: document.getElementById('quote-phone-error'),
            check: function (value) {
                if (!value) {
                    return '';
                }
                if (/[a-z]/i.test(value)) {
                    return 'Please enter a valid phone number, or leave this blank.';
                }
                var digits = value.replace(/\D/g, '');
                if (digits.length < 10 || digits.length > 15) {
                    return 'Please enter a valid phone number, or leave this blank.';
                }
                return '';
            }
        },
        {
            input: document.getElementById('quote-address'),
            error: document.getElementById('quote-address-error'),
            check: function (value) {
                if (!value) {
                    return 'Please enter the property address or city.';
                }
                return '';
            }
        },
        {
            input: document.getElementById('quote-size'),
            error: document.getElementById('quote-size-error'),
            check: function (value) {
                if (!value) {
                    return '';
                }
                var size = Number(value);
                if (!isFinite(size) || size <= 0) {
                    return 'Please enter a size greater than 0, or leave this blank.';
                }
                return '';
            }
        }
    ];

    function setError(field, message) {
        if (message) {
            field.input.setAttribute('aria-invalid', 'true');
            field.input.classList.add('is-invalid');
            field.error.textContent = message;
        } else {
            field.input.removeAttribute('aria-invalid');
            field.input.classList.remove('is-invalid');
            field.error.textContent = '';
        }
    }

    function validate() {
        var firstInvalid = null;
        fields.forEach(function (field) {
            var message = field.check(field.input.value.trim());
            setError(field, message);
            if (message && !firstInvalid) {
                firstInvalid = field.input;
            }
        });
        return firstInvalid;
    }

    fields.forEach(function (field) {
        field.input.addEventListener('input', function () {
            if (field.input.getAttribute('aria-invalid') === 'true') {
                setError(field, field.check(field.input.value.trim()));
            }
        });
    });

    form.addEventListener('submit', function (event) {
        var honey = form.querySelector('[name="_honey"]');
        if (honey && honey.value) {
            event.preventDefault();
            return;
        }

        var firstInvalid = validate();
        if (firstInvalid) {
            event.preventDefault();
            if (summary) {
                summary.textContent = 'Please fix the highlighted fields before sending your request.';
            }
            firstInvalid.focus({ preventScroll: true });
            var fieldTop = firstInvalid.getBoundingClientRect().top + window.pageYOffset - 140;
            window.scrollTo({ top: Math.max(0, fieldTop), behavior: 'smooth' });
            return;
        }

        if (summary) {
            summary.textContent = '';
        }

        ['quote-name', 'quote-company', 'quote-email', 'quote-phone', 'quote-address', 'quote-message'].forEach(function (id) {
            var input = document.getElementById(id);
            if (input) {
                input.value = input.value.trim();
            }
        });

        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Sending...';
            window.setTimeout(function () {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Get a Free Quote';
            }, 8000);
        }
    });
})();
