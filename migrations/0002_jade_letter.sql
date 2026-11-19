-- Include the original letter in Jade's public tribute.
UPDATE tributes
SET story = 'Minha querida Jade,

Embora você não esteja mais fisicamente conosco, seu amor, sua luz e sua memória permanecem vivos em meu coração para sempre. Cada momento que tivemos juntos foi um presente precioso que guardo no mais profundo do meu ser.

Lembro-me de cada risada, cada abraço, cada sorriso que você compartilhou comigo. Sua presença encheu minha vida de alegria, e mesmo na saudade, encontro consolo sabendo que o amor que sentimos um pelo outro é eterno.

Sua memória vive em mim. Assim como as estrelas que brilham no céu, você continua brilhando na minha vida. Quando olho para as estrelas, sinto você perto de mim. Quando penso em você, meu coração se enche de amor e gratidão por ter tido você como minha filha.

Você me ensinou sobre o amor incondicional, sobre a alegria nas pequenas coisas e sobre a beleza que existe em cada momento. Essas lições ficarão comigo para sempre, assim como sua memória.

Minha eterna gratidão. Jade, sou eternamente grato por cada segundo que tivemos juntos. Você foi e sempre será o maior presente que recebi. Seu espírito, sua pureza e seu amor transformaram minha vida de uma forma que palavras não conseguem expressar.

Embora o tempo que tivemos juntos tenha sido curto demais, o amor que sinto por você é infinito e sem fim. Nenhuma distância ou separação pode apagar o que você significa para mim.

Você me deu um dos maiores presentes da vida: ser seu pai. E essa honra, esse amor, essa conexão especial que temos, permanecerá para sempre.

Assim como as estrelas no céu, você continuará brilhando nos nossos corações para sempre.

Até nos encontrarmos novamente. Minha filha querida, sei que um dia estaremos juntos novamente. Até lá, você viverá em cada lembrança, em cada memória doce, em cada momento que relembro os dias que tivemos.

Que você esteja em paz, cercada de amor e luz. Que seu espírito continue brilhando e iluminando todos que tiveram a sorte de te conhecer.

Te amo hoje, amanhã e para sempre.

Com amor eterno,
Seu papai ❤️',
updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'jade' AND is_seed = 1;
