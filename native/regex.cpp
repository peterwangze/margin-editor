#define BOOST_REGEX_STANDALONE
#include <boost/regex.hpp>
#include <cstdint>
#include <cstdlib>
#include <string>
#include <string_view>
#include <vector>

namespace {
std::u16string message;
std::u16string inserts;
std::vector<uint32_t> results;

void failure(const char* error) {
    message.clear();
    while (*error) message.push_back(static_cast<unsigned char>(*error++));
}
}

extern "C" {
#ifdef __wasi__
// WASI SDK's libc++abi lacks exception handling. A regex error ends this disposable worker operation.
[[noreturn]] void margin_abort();
void* __cxa_allocate_exception(size_t length) noexcept { return std::malloc(length); }
void __cxa_free_exception(void* data) noexcept { std::free(data); }
[[noreturn]] void __cxa_throw(void*, void*, void(*)(void*)) { margin_abort(); }
[[noreturn]] void __cxa_rethrow() { margin_abort(); }
void* __cxa_begin_catch(void* data) noexcept { return data; }
void __cxa_end_catch() {}
#endif
void* margin_alloc(uint32_t length) { return std::malloc(length); }
void margin_free(void* data) { std::free(data); }
const char16_t* margin_message() { return message.data(); }
uint32_t margin_message_length() { return static_cast<uint32_t>(message.size()); }
const char16_t* margin_inserts() { return inserts.data(); }
const uint32_t* margin_results() { return results.data(); }
uint32_t margin_count() { return static_cast<uint32_t>(results.size() / 4); }

int margin_regex(const char16_t* text, uint32_t length, const char16_t* pattern, uint32_t pattern_length,
                 const char16_t* replacement, uint32_t replacement_length,
                 uint32_t from, uint32_t to, uint32_t limit, uint32_t options) {
    message.clear();
    results.clear();
    inserts.clear();
    {
        // wchar_t is 32-bit in WASI. Widen UTF-16 units individually to match Scintilla's Windows positions.
        std::wstring source(text, text + length);
        std::wstring expression(pattern, pattern + pattern_length);
        std::wstring format(replacement, replacement + replacement_length);
        if (options & 4) expression = L"\\b(?:" + expression + L")\\b";
        const auto flags = boost::regex_constants::normal | boost::regex_constants::no_except | ((options & 1) ? boost::regex_constants::icase : 0);
        const boost::wregex regex(expression, flags);
        if (regex.status()) { failure("Invalid Boost regular expression."); return -1; }
        const auto begin = source.cbegin();
        const auto finish = begin + to;
        auto search = begin + from;
        boost::match_results<std::wstring::const_iterator> match;
        auto matching = (options & 2) ? boost::match_default : boost::match_not_dot_newline;
        if (from) matching |= boost::match_prev_avail;
        while (boost::regex_search(search, finish, match, regex, matching, begin)) {
            const auto first = match[0].first;
            const auto last = match[0].second;
            const auto value = match.format(format, boost::format_all, regex);
            if (results.size() / 4 == limit || value.size() + inserts.size() > 16 * 1024 * 1024) return 1;
            results.push_back(static_cast<uint32_t>(first - begin));
            results.push_back(static_cast<uint32_t>(last - begin));
            results.push_back(static_cast<uint32_t>(inserts.size()));
            results.push_back(static_cast<uint32_t>(value.size()));
            for (auto ch : value) inserts.push_back(static_cast<char16_t>(ch));
            if (last == finish) break;
            search = first == last ? last + 1 : last;
            if (first == last && search < finish && *search >= 0xdc00 && *search <= 0xdfff && *last >= 0xd800 && *last <= 0xdbff) ++search;
            matching |= boost::match_prev_avail;
        }
        return 0;
    }
}
}
